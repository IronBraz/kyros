# seed_demo_conversation.ps1
# Seeds fake AI conversations into the DB so ContextSummaryCard can be tested
# without manually chatting. Run from Windows with psql in PATH, or copy the
# generated SQL and paste it into a psql session on the VPS directly.
#
# Usage:
#   .\seed_demo_conversation.ps1                          # prints SQL, doesn't execute
#   .\seed_demo_conversation.ps1 -Execute                 # runs via psql with params below
#   .\seed_demo_conversation.ps1 -Execute -Scenario frustrated
#   .\seed_demo_conversation.ps1 -Cleanup                 # removes all seeded rows

param(
    [switch]$Execute,
    [switch]$Cleanup,
    [ValidateSet('curious','frustrated','outofscope','all')]
    [string]$Scenario = 'all',
    [string]$PgHost     = 'mind.neuroforge.club',
    [int]   $PgPort     = 5432,
    [string]$PgDb       = 'kyros_db',
    [string]$PgUser     = 'turbo_g3pp3tto',
    [string]$PgPassword = ''   # set via PGPASSWORD env var or .pgpass on VPS
)

# ─── helpers ─────────────────────────────────────────────────────────────────

function Invoke-Sql {
    param([string]$Sql)
    if ($PgPassword) { $env:PGPASSWORD = $PgPassword }
    $Sql | psql -h $PgHost -p $PgPort -U $PgUser -d $PgDb
}

function Write-Sql {
    param([string]$Sql)
    Write-Host "`n--- SQL ---`n$Sql`n--- END ---`n" -ForegroundColor Cyan
}

# ─── cleanup ─────────────────────────────────────────────────────────────────

$CleanupSql = @'
-- Remove all seeded demo sessions (identified by ticket_code prefix 'SEED-')
DO $$
DECLARE
  sess_id UUID;
BEGIN
  FOR sess_id IN
    SELECT id FROM sessions WHERE ticket_code LIKE 'SEED-%'
  LOOP
    DELETE FROM ai_summaries      WHERE conversation_id IN
        (SELECT id FROM ai_conversations WHERE session_id = sess_id);
    DELETE FROM ai_messages       WHERE conversation_id IN
        (SELECT id FROM ai_conversations WHERE session_id = sess_id);
    DELETE FROM ai_conversations  WHERE session_id = sess_id;
    DELETE FROM sessions          WHERE id = sess_id;
  END LOOP;
END $$;
'@

if ($Cleanup) {
    Write-Host "Cleaning up seeded demo data…" -ForegroundColor Yellow
    if ($Execute) { Invoke-Sql $CleanupSql } else { Write-Sql $CleanupSql }
    exit 0
}

# ─── resolve store + entry_point ─────────────────────────────────────────────
# The SQL uses subselects so it works without hardcoded UUIDs.
# Adjust the store name filter if your demo store has a different name.

$STORE_FILTER = "demo"          # substring match against stores.name (case-insensitive)
$SERVICE_POINT_NAME = "Cassa A" # must match an existing service_point name

# ─── scenario SQL generators ─────────────────────────────────────────────────

function Get-ScenarioSql {
    param(
        [string]$TicketCode,
        [string]$SentimentVal,     # '1', '0', '-1'
        [string]$SummaryText,
        [string]$FlagsJson,        # e.g. '["product-inquiry"]'
        [string[]]$UserMessages,
        [string[]]$AiMessages
    )

    if ($UserMessages.Count -ne $AiMessages.Count) {
        throw "UserMessages and AiMessages must have the same length"
    }

    $msgInserts = @()
    for ($i = 0; $i -lt $UserMessages.Count; $i++) {
        $u = $UserMessages[$i].Replace("'", "''")
        $a = $AiMessages[$i].Replace("'", "''")
        $msgInserts += "  INSERT INTO ai_messages (conversation_id, role, content, tokens_in, tokens_out, model, latency_ms) VALUES (conv_id, 'user',      '$u', 120, 0,   'anthropic/claude-haiku-4-5', NULL);"
        $msgInserts += "  INSERT INTO ai_messages (conversation_id, role, content, tokens_in, tokens_out, model, latency_ms) VALUES (conv_id, 'assistant', '$a', 0,   85,  'anthropic/claude-haiku-4-5', 1240);"
    }
    $allMsgInserts = $msgInserts -join "`n"
    $msgCount = $UserMessages.Count * 2
    $summaryTextEsc = $SummaryText.Replace("'", "''")

    return @"
DO `$`$
DECLARE
  store_id_val  UUID;
  ep_id         UUID;
  sess_id       UUID;
  conv_id       UUID;
BEGIN
  -- Resolve store
  SELECT id INTO store_id_val FROM stores WHERE LOWER(name) LIKE '%${STORE_FILTER}%' LIMIT 1;
  IF store_id_val IS NULL THEN
    RAISE EXCEPTION 'Store matching "${STORE_FILTER}" not found. Edit STORE_FILTER in the script.';
  END IF;

  -- Resolve entry point
  SELECT id INTO ep_id FROM entry_points WHERE store_id = store_id_val LIMIT 1;
  IF ep_id IS NULL THEN
    RAISE EXCEPTION 'No entry_point found for store %. Create one first.', store_id_val;
  END IF;

  -- Create session (status=called so ContextSummaryCard renders)
  INSERT INTO sessions (store_id, entry_point_id, ticket_code, status, called_at)
  VALUES (store_id_val, ep_id, '${TicketCode}', 'called', NOW())
  RETURNING id INTO sess_id;

  -- Create conversation
  INSERT INTO ai_conversations (session_id, started_at, ended_at, wiki_version, message_count, last_message_at)
  VALUES (sess_id, NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '1 minute', '1.0', $msgCount, NOW() - INTERVAL '1 minute')
  RETURNING id INTO conv_id;

  -- Link back to session
  UPDATE sessions SET ai_conversation_id = conv_id WHERE id = sess_id;

  -- Insert messages
$allMsgInserts

  -- Insert summary (ready state)
  INSERT INTO ai_summaries (conversation_id, summary, sentiment, flags, model, status, generated_at)
  VALUES (conv_id, '${summaryTextEsc}', ${SentimentVal}, '${FlagsJson}'::jsonb, 'anthropic/claude-haiku-4-5', 'ready', NOW());

  RAISE NOTICE 'Seeded: ticket=%, session=%, conversation=%', '${TicketCode}', sess_id, conv_id;
END `$`$;
"@
}

# ─── scenario definitions ─────────────────────────────────────────────────────

$scenarios = @{}

# Scenario 1: Curious customer (sentiment +1)
$scenarios['curious'] = Get-ScenarioSql `
    -TicketCode   'SEED-CUR-001' `
    -SentimentVal '1' `
    -SummaryText  'Customer interested in coffee blends and machine comparison. Asked about Arabica vs Robusta and differences between two espresso machines. Engaged and curious, likely ready to purchase.' `
    -FlagsJson    '["product-inquiry","machine-comparison"]' `
    -UserMessages @(
        'What time do you close today?',
        'What blends do you sell? What is the difference between them?',
        'I am torn between the two main espresso machines — can you help me decide?',
        'Does the Arabica blend work well as a lungo?'
    ) `
    -AiMessages @(
        'We are open until 8 PM today. Is there anything else I can help you with while you wait?',
        'We carry two main blends: our Arabica blend is smooth and aromatic with floral notes, while the Robusta blend has a bolder, more intense flavour with higher caffeine. Both are available in capsule format.',
        'Great question! The Entry model is perfect for home use — compact and easy to maintain. The Pro model offers more pressure control and a larger water tank, ideal if you make multiple coffees a day. What is your typical daily usage?',
        'Absolutely! The Arabica blend is quite versatile and works beautifully as a lungo — the lower bitterness means it stays balanced even when extracted longer. Many customers prefer it for afternoon drinks.'
    )

# Scenario 2: Frustrated customer (sentiment -1)
$scenarios['frustrated'] = Get-ScenarioSql `
    -TicketCode   'SEED-FRU-001' `
    -SentimentVal '-1' `
    -SummaryText  'Customer reporting broken machine under warranty, frustrated by lack of response from support. Requested refund or replacement. Emotional tone negative. Needs immediate in-store attention.' `
    -FlagsJson    '["return-issue","complaint","warranty"]' `
    -UserMessages @(
        'Hi, I bought one of your machines 2 months ago and the pump just broke.',
        'I contacted support 3 times and nobody replied. I am really frustrated.',
        'I want a refund or a replacement — what are my options?',
        'Is there anything you can do right now or do I have to wait again?'
    ) `
    -AiMessages @(
        'I am really sorry to hear that — a pump failure after only two months is not acceptable. I completely understand your frustration.',
        'That is genuinely disappointing and I apologize on behalf of the team. You should never be left waiting without a reply. I want to make sure the assistant who sees you today is fully aware of the situation.',
        'Under our returns policy, machines within the warranty period qualify for repair or replacement. The store assistant will be able to review your purchase and open a formal case today.',
        'The assistant who calls your ticket will have a summary of our conversation and will prioritize getting this resolved for you. You should not have to repeat everything. I am sorry again for the trouble you have experienced.'
    )

# Scenario 3: Out-of-scope (sentiment 0)
$scenarios['outofscope'] = Get-ScenarioSql `
    -TicketCode   'SEED-OOS-001' `
    -SentimentVal '0' `
    -SummaryText  'Customer asked several off-topic questions (investments, cooking). AI redirected to store topics. No purchase signals detected. Neutral interaction.' `
    -FlagsJson    '["off-topic"]' `
    -UserMessages @(
        'Can you recommend some investments for my savings?',
        'Give me a pasta carbonara recipe.',
        'OK fine — what machines do you sell then?'
    ) `
    -AiMessages @(
        'Financial advice is a bit outside my expertise, I am afraid! I am here to help with anything related to our coffee products and store. Can I help you with something while you wait?',
        'Ha, I wish I could help with that! My speciality is coffee rather than cooking. Speaking of which, our espresso machines make a great addition to any kitchen — shall I tell you about them?',
        'Of course! We carry two main models: a compact home machine and a higher-capacity Pro model. Both use our capsule system. Would you like to know more about either one?'
    )

# ─── generate / execute ───────────────────────────────────────────────────────

$toRun = if ($Scenario -eq 'all') { @('curious','frustrated','outofscope') } else { @($Scenario) }

foreach ($sc in $toRun) {
    $sql = $scenarios[$sc]
    Write-Host "`nScenario: $sc" -ForegroundColor Green
    if ($Execute) {
        Write-Host "Executing…" -ForegroundColor DarkGray
        Invoke-Sql $sql
    } else {
        Write-Sql $sql
    }
}

if (-not $Execute) {
    Write-Host @"

To execute, run:
  .\seed_demo_conversation.ps1 -Execute

Or copy the SQL above and run it directly in psql on the VPS:
  psql -U turbo_g3pp3tto -d kyros_db

Then open the Admin Control Room -> Counter Mode to see the seeded customers
with their ContextSummaryCard summaries already populated.
"@ -ForegroundColor Yellow
}
