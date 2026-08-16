// The AI concierge the customer talks to while waiting.
//
// Two endpoints, both hit from the phone with no authentication beyond knowing a session id.
// That makes the spending guards the important part: a turn cap per conversation, a hard
// monthly budget, and (added in phase 4) a rate limit per session.
import { Hono } from 'hono';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { db } from '../lib/db.js';
import { chatCompletion } from '../lib/openrouter.js';
import { ErrorCode, fail, ok } from '../lib/respond.js';
import { loadWiki } from '../lib/wiki.js';

const chat = new Hono();

const uuid = z.string().uuid();

// POST /api/v1/client/chat/start
// Idempotent: a customer reopening the panel resumes the same conversation rather than
// starting a fresh one, so history and the turn cap survive a page refresh.
chat.post('/chat/start', async (c) => {
  const parsed = z
    .object({ session_id: uuid })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'session_id must be a uuid', 400);
  }
  const sql = db();

  const rows = (await sql`
    SELECT s.id, s.status, s.ai_conversation_id,
           conv.id           AS conv_id,
           conv.wiki_version AS conv_wiki_version
      FROM sessions s
      LEFT JOIN ai_conversations conv ON conv.id = s.ai_conversation_id
     WHERE s.id = ${parsed.data.session_id}
  `) as Array<Record<string, unknown>>;

  const session = rows[0];
  if (!session) return fail(c, ErrorCode.SESSION_NOT_FOUND, 'Session not found.', 404);

  if (session.conv_id) {
    return ok(c, {
      conversation_id: session.conv_id,
      wiki_version: session.conv_wiki_version,
      resumed: true,
    });
  }

  // Stamping the wiki version onto the conversation records which knowledge base the
  // customer was actually answered from, which is what makes a later complaint auditable.
  const wiki = await loadWiki();
  const version = wiki?.version ?? 'unknown';

  // Two writes that must not half-apply: a conversation with no back-reference on the
  // session would be created again on the next call, and the customer would lose history.
  const [created] = await sql.transaction((tx) => [
    tx`INSERT INTO ai_conversations (session_id, started_at, wiki_version, message_count, last_message_at)
       VALUES (${session.id as string}, NOW(), ${version}, 0, NOW())
       RETURNING id, wiki_version`,
    tx`UPDATE sessions
          SET ai_conversation_id = (SELECT id FROM ai_conversations WHERE session_id = ${session.id as string})
        WHERE id = ${session.id as string}`,
  ]);

  const conv = (created as Array<Record<string, unknown>>)[0];
  return ok(
    c,
    { conversation_id: conv?.id, wiki_version: conv?.wiki_version, resumed: false },
    201
  );
});

// POST /api/v1/client/chat/send
const sendBody = z.object({
  conversation_id: uuid,
  message: z.string().min(1).max(2000),
});

chat.post('/chat/send', async (c) => {
  const parsed = sendBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, ErrorCode.VALIDATION_FAILED, 'Invalid request body', 400, parsed.error.issues);
  }
  const { conversation_id, message } = parsed.data;
  const sql = db();

  const convRows = (await sql`
    SELECT id, message_count FROM ai_conversations WHERE id = ${conversation_id}
  `) as Array<{ id: string; message_count: number }>;

  const conv = convRows[0];
  if (!conv) return fail(c, ErrorCode.NOT_FOUND, 'Conversation not found.', 404);

  // Both caps answer 200 with capped:true rather than an error. The ChatPanel renders the
  // reply as a normal assistant message and disables the input; an error would show a
  // failure banner, which is the wrong story for "we have chatted enough".
  if (conv.message_count >= config.chatTurnCap) {
    return ok(c, {
      reply: "We've chatted plenty! Your turn is coming up soon — see you at the desk.",
      message_count: conv.message_count,
      capped: true,
      capped_reason: 'turn',
    });
  }

  const budget = (await sql`
    SELECT total_cost_eur
      FROM ai_usage_monthly
     WHERE year_month = TO_CHAR(NOW(), 'YYYY-MM')
     LIMIT 1
  `) as Array<{ total_cost_eur: string }>;

  const spent = Number(budget[0]?.total_cost_eur ?? 0);
  if (spent >= config.aiBudgetEur) {
    return ok(c, {
      reply: "Our concierge is taking a break right now. Please ask the assistant when it's your turn.",
      message_count: conv.message_count,
      capped: true,
      capped_reason: 'budget',
    });
  }

  const wiki = await loadWiki();
  if (!wiki) {
    // The frontend special-cases this code to show "concierge unavailable" instead of a
    // generic error, so the string matters.
    return fail(c, ErrorCode.WIKI_NOT_LOADED, 'Knowledge base is not available.', 503);
  }

  const history = (await sql`
    SELECT role, content
      FROM ai_messages
     WHERE conversation_id = ${conversation_id}
     ORDER BY created_at ASC
  `) as Array<{ role: 'user' | 'assistant'; content: string }>;

  let completion;
  try {
    completion = await chatCompletion(wiki.content, history, message);
  } catch (err) {
    console.error('[kyros] chat completion failed', err);
    return fail(c, ErrorCode.UPSTREAM_ERROR, 'The concierge is unreachable right now.', 502);
  }

  // One transaction for the whole bookkeeping: both messages, the conversation counter and
  // the monthly spend. Billing for a reply we failed to store, or storing a reply we never
  // billed, both corrupt the budget the €3 cap depends on.
  const [countRows] = await sql.transaction((tx) => [
    tx`UPDATE ai_conversations
          SET message_count = message_count + 2, last_message_at = NOW()
        WHERE id = ${conversation_id}
        RETURNING message_count`,
    tx`INSERT INTO ai_messages (conversation_id, role, content, tokens_in, tokens_out, model, latency_ms)
       VALUES (${conversation_id}, 'user', ${message}, 0, 0, ${completion.model}, 0)`,
    tx`INSERT INTO ai_messages (conversation_id, role, content, tokens_in, tokens_out, model, latency_ms)
       VALUES (${conversation_id}, 'assistant', ${completion.reply},
               ${completion.inputTokens}, ${completion.outputTokens},
               ${completion.model}, ${completion.latencyMs})`,
    tx`INSERT INTO ai_usage_monthly (year_month, total_input_tokens, total_output_tokens, total_cost_eur, last_updated)
       VALUES (TO_CHAR(NOW(), 'YYYY-MM'), ${completion.inputTokens}, ${completion.outputTokens},
               ${completion.costEur}, NOW())
       ON CONFLICT (year_month) DO UPDATE
          SET total_input_tokens  = ai_usage_monthly.total_input_tokens  + EXCLUDED.total_input_tokens,
              total_output_tokens = ai_usage_monthly.total_output_tokens + EXCLUDED.total_output_tokens,
              total_cost_eur      = ai_usage_monthly.total_cost_eur      + EXCLUDED.total_cost_eur,
              last_updated        = NOW()`,
  ]);

  const messageCount = (countRows as Array<{ message_count: number }>)[0]?.message_count;

  return ok(c, {
    reply: completion.reply,
    message_count: messageCount ?? conv.message_count + 2,
    capped: false,
    capped_reason: null,
  });
});

export default chat;
