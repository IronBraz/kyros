# Kyros — Handover Document: Move to PILOT Phase

**Versione:** 1.0 (bozza per ridiscussione)
**Data:** 2026-05-15
**Autore:** Conversazione tra Gualtiero Brazzelli (owner) e Claude Code (Opus 4.7)
**Stato del documento:** Da rivedere e approvare prima dell'implementazione.

---

## 1. Scopo di questo documento

Questo documento è un **handover** pensato per essere ridato in pasto a una futura sessione di Claude Code (o a un collaboratore umano). Riassume:

1. **Da dove siamo partiti** (l'MVP attuale, già funzionante)
2. **Dove vogliamo arrivare** (la fase PILOT, con chat AI e knowledge base)
3. **La domanda originaria** che ha generato la conversazione (vale ancora il piano fatto mesi fa, oppure il pattern "LLM Wiki" di Andrej Karpathy è migliore per il nostro caso?)
4. **L'analisi comparativa** dei due approcci con tutti i pro e contro discussi
5. **Le decisioni prese durante la conversazione** (con motivazioni e domande chiarificatrici fatte all'owner)
6. **Il piano implementativo dettagliato** in 7 fasi
7. **I rischi e le decisioni ancora aperte**

Il documento è scritto in modo **self-contained**: chi lo legge a freddo deve poter capire tutto senza dover ripescare conversazioni precedenti.

> ⚠️ **Non eseguire** quanto scritto qui senza esplicita approvazione dell'owner. L'intenzione è continuare la discussione prima di iniziare l'implementazione.

---

## 2. Punto di partenza: stato dell'MVP

L'MVP (Fase 1 – "Store Flow Foundation") **funziona**. Ecco la fotografia rilevante:

### 2.1 Backend (n8n)
- **24 workflow** operativi in `OUTPUT/n8n/`
- Coprono: queue FIFO, auth PIN, marketing cards, janitor (sessioni ghost), daily reset, multi-tenant, infrastructure management
- Sub-workflow riutilizzabili: `005_Response_Standardizer`, `006_Auth_Manager`
- **Zero workflow AI / LLM / embedding** al momento

### 2.2 Database (PostgreSQL 18.1)
- Schema completo in `OUTPUT/postgres/kyros_schema.sql`
- Tabelle: `tenants`, `stores`, `entry_points`, `service_points`, `sessions`, `marketing_cards`, `admin_access`
- Campi **già predisposti per l'AI ma non usati**: `sessions.ai_context` (JSONB), `sessions.sentiment_score` (int)
- **Mancano**: tabelle conversazioni, messaggi, summaries

### 2.3 Frontend (React PWA — `OUTPUT/pwa/UNIFIED/`)
- **Realtà del codice** (verificata): React **19**, Vite 6, Tailwind 4, Zustand 5, `lucide-react`, `qrcode`, `html5-qrcode`, `recharts`. Niente `socket.io-client`, niente `ky`.
- Comunicazione frontend↔backend: `fetch` + **polling** (3s in `WaitingRoom.tsx`, ~5s in `ControlRoom.tsx`)
- Pagine cliente: Landing, WaitingRoom, YourTurn, ThankYou
- Pagine admin: ControlRoom con 5 modi (Counter, Analytics, Zones, Content, Settings) + LoginGate PIN
- **Mancano**: componenti Chat AI lato cliente, Context Summary card lato admin

### 2.4 Discrepanza specs vs codice (importante da segnalare)
Le specs (`SPECS/06_Frontend_Apps.md`, `05_Infra_Architecture.md`) menzionano Socket.io e Ky. Il **codice reale non li usa**. Le specs sono in parte aspirazionali. Per il Pilot **non introduciamo Socket.io ora** — useremo il polling già in piedi (è più che sufficiente per use-case interno/demo).

---

## 3. L'obiettivo: cosa è la fase PILOT

Dalle specs (`SPECS/01_Vision_e_Business.md:29-36` e `SPECS/07_AI_Engine.md`):

1. **Chat AI interattiva lato cliente** durante l'attesa in coda (sostituisce i placeholder marketing dell'MVP)
2. **Knowledge base**: l'AI risponde sulla base di documenti dello store (orari, policy resi, FAQ, catalogo, ecc.)
3. **Context Summary + Sentiment** per l'operatore: quando il cliente arriva al turno, l'operatore vede in Control Room un riassunto della conversazione AI + un sentiment flag (verde/giallo/rosso)
4. La coda rimane **FIFO**: l'AI intrattiene e qualifica, non altera l'ordine
5. **Persona AI**: Concierge Esperto del Brand — tono caldo, professionale, sintetico (2-3 frasi mobile-optimized), prime directive = nessun danno reputazionale

### 3.1 Vincoli espressi dall'owner in questa conversazione
- **Uso interno / demo del concept**, non production
- **Knowledge base piccola**: 3-5 PDF di 30-60 pagine ciascuno (totale ~150-300 pagine)
- **Privacy**: contenuti misti — alcuni pubblici (orari/FAQ), alcuni interni (procedure, SLA, pricing rules)
- **Performance attese** (dalle specs): TTFT < 1.5s, risposta completa entro 4-5s, streaming obbligatorio

---

## 4. La domanda originaria che ha generato la conversazione

Mesi fa avevamo definito (in `SPECS/07_AI_Engine.md`) un approccio **RAG classico**:
- Vector DB: PostgreSQL con `pgvector`
- Embeddings: OpenAI `text-embedding-3-small` (o open-source locale se privacy-critical)
- Layer 3 "Strict Grounding": l'AI risponde solo su contenuti presenti nella knowledge base vettoriale
- Semantic caching per FAQ frequenti
- LLM real-time: GPT-4o-mini o Claude 3 Haiku

L'owner ha letto la nota di **Andrej Karpathy sul pattern "LLM Wiki"** ([copy del testo riassunto in §4.1](#41-cosè-il-pattern-llm-wiki-di-karpathy)) e ha chiesto:

> *"Mi domandavo se quello che avevamo pensato qualche mese fa sia ancora la strada più giusta o LLM Wiki di Karpathy potesse essere una strada migliore. Considera che sarà sempre uso interno, non andremo in produzione, ma solo per far vedere che il concetto funziona. Il challenge è integrare la chat (lato cliente) e fare il summary lato admin delle conversazioni che l'AI avrà con l'utente. Per il knowledge da far ingerire direi pochi PDF (3-5, di 30-60 pagine ciascuno). Quanto è difficile rispetto al MVP attuale muoverci alla fase di Pilot?"*

### 4.1 Cos'è il pattern "LLM Wiki" di Karpathy

Sintesi: invece di fare RAG (recuperare chunk grezzi a query-time da raw docs), si **pre-compila una volta** una "wiki" di file markdown strutturati e interlinkati. Architettura a 3 layer:

1. **Raw sources** — i PDF originali, immutabili
2. **The wiki** — directory di markdown generati dall'LLM: pagine per topic/entità, un `index.md` (TOC), un `log.md` (cronologico)
3. **The schema** — un `CLAUDE.md` (o `AGENTS.md`) che definisce convenzioni di scrittura e workflow

Operazioni: **Ingest** (LLM legge un PDF nuovo, aggiorna pagine wiki esistenti, aggiunge nuove), **Query** (LLM legge l'index, drill-in nelle pagine pertinenti, sintetizza), **Lint** (controllo contraddizioni, pagine orfane, stale claims).

Differenza chiave vs RAG: la **conoscenza è compilata e mantenuta**, non riderivata su ogni query. Le cross-reference esistono già. Le contraddizioni sono già state risolte a tempo di ingest.

Funziona meglio su **corpus piccoli e stabili** (~100 sources, qualche centinaio di pagine), perché altrimenti il wiki diventa ingestibile. Per il nostro caso (3-5 PDF) è ben sotto la soglia.

---

## 5. Analisi: RAG classico vs LLM Wiki per Kyros

### 5.1 Tabella comparativa (per il nostro caso specifico)

| Aspetto | RAG classico (piano originale) | LLM Wiki (alternativa proposta) |
|---|---|---|
| **Infrastruttura** | pgvector, pipeline chunking, API embedding, eventuale reranker | Solo file markdown + prompt caching |
| **Latenza** | ~100-300ms retrieval + LLM | ~0ms retrieval (wiki in cache) + LLM |
| **Costo a query** | embedding API + LLM | LLM con cache (sconto >90% sui token cached con Anthropic) |
| **Debuggabilità** | "perché ha pescato quel chunk?" | Leggi il file `.md` per sapere cosa l'AI ha visto |
| **Failure mode tipico** | Chunk mancante / split a metà concetto | Pagina wiki scritta male (correggibile a mano) |
| **Scalabilità** | Bene fino a 10k+ docs | Tensione sopra ~500 pagine |
| **Tempo a implementare** | ~1 settimana per pipeline pulita | ~2-3 giorni |
| **Curabilità** | Limitata (vector è opaco) | Alta (markdown editabili in git) |

### 5.2 Perché per Kyros il Wiki è la scelta tecnicamente migliore

Tre caratteristiche del nostro caso lo rendono ideale:

1. **Corpus minuscolo e stabile**: 3-5 PDF, ~150-300 pagine. Non cambia ogni settimana.
2. **Domande tendenzialmente ripetitive**: orari, resi, prodotti, policy. Coda lunga di query limitata.
3. **Uso interno/demo**: serve dimostrare che funziona, non reggere 10k store concorrenti.

Inoltre, **due novità del 2025/2026** rendono il Wiki ancora più conveniente:
- **Prompt caching** di Anthropic: caricare l'intero wiki nel system prompt costa quasi nulla dopo il primo hit. Il "retrieval" diventa gratuito.
- **Claude Haiku 4.5**: più veloce e più capace di Claude 3 Haiku (che era nelle specs originali). TTFT sub-secondo realistico.

### 5.3 Quando NON sarebbe la scelta giusta
Se il corpus crescesse oltre ~500 pagine, o se le fonti cambiassero ogni giorno, o se servisse precisione massima su documenti tecnici densi, RAG classico tornerebbe vincente. Per ora siamo lontani da quei limiti.

### 5.4 Path di migrazione
Se in futuro il corpus crescesse, il lavoro fatto sul wiki **non viene buttato**: le pagine markdown diventano un corpus pre-processato di altissima qualità da indicizzare con embeddings (è anche più "RAG-friendly" dei PDF grezzi).

---

## 6. Decisioni prese in questa conversazione

L'owner ha confermato tramite domande dirette (`AskUserQuestion`):

| Decisione | Scelta | Razionale |
|---|---|---|
| **Approccio knowledge** | LLM Wiki (no pgvector) | Migliore per corpus piccolo, più veloce, più curabile |
| **LLM chat real-time** | Claude Haiku 4.5 | Più veloce/economico nel 2026, prompt caching potente |
| **LLM summary/sentiment** | Stesso modello (Haiku 4.5) | Una sola dipendenza; qualità OK per 5-10 turni di chat |
| **Privacy KB** | Misto (pubblico + interno) | Risolto con due namespace separati: `knowledge/public/` (chat cliente) + `knowledge/internal/` (admin only) |
| **Scope iterazione** | Piano completo end-to-end | Tutto il Pilot in un colpo (~1.5-2 settimane) |

### 6.1 Architettura aggiornata (sintesi)

```
┌─────────────────────────────────────────────────────────────────┐
│  COMPONENTI NUOVI PER IL PILOT                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  knowledge/                                                     │
│    public/   ← visibile alla chat cliente                       │
│    internal/ ← solo per workflow admin                          │
│    index.md, log.md, CLAUDE.md                                  │
│                                                                 │
│  AI Gateway (microservizio Node, nuovo)                         │
│    ↓ gestisce streaming SSE verso il frontend                   │
│    ↓ carica wiki, chiama Anthropic con prompt caching           │
│    ↓ delega persistenza turni a n8n                             │
│                                                                 │
│  n8n (orchestratore)                                            │
│    - bootstrap conversazione, persist turni                     │
│    - JOB summary+sentiment async (Haiku 4.5)                    │
│                                                                 │
│  PostgreSQL                                                     │
│    + ai_conversations                                           │
│    + ai_messages                                                │
│    + ai_summaries                                               │
│                                                                 │
│  Frontend React                                                 │
│    + ChatPanel (cliente, bottom sheet)                          │
│    + ContextSummaryCard (admin, sopra customer chiamato)        │
│    + useChatStore (zustand)                                     │
│    + chatStream helper (fetch + ReadableStream, no Socket.io)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Perché un microservizio "AI Gateway" separato?**
n8n non è ergonomico per long-lived SSE (streaming HTTP). Una semplice app Node (~200 righe Express) gestisce lo streaming verso il frontend, mentre n8n resta l'orchestratore per auth, persistenza, policy. È un compromesso pragmatico per evitare workaround complessi in n8n.

---

## 7. Il piano implementativo (7 fasi)

> **Tempo totale stimato:** 9-11 giorni-persona (~1.5-2 settimane)
> **Sequenza:** F1 ∥ F2 → F3 → {F4, F5} → F6 → F7

### F1 — Knowledge Wiki pre-processing — 1 giorno

Creare la nuova directory radice `knowledge/` con:

```
knowledge/
├── CLAUDE.md              # Convenzioni per future iterazioni dell'LLM
├── index.md               # TOC con 1-riga summary per pagina
├── log.md                 # Append-only chronological log
├── public/                # Visibile alla chat cliente
│   ├── policy_resi.md
│   ├── orari.md
│   ├── catalogo_overview.md
│   ├── faq.md
│   └── servizi_in_store.md
├── internal/              # Solo workflow admin, MAI alla chat cliente
│   ├── sla_staff.md
│   ├── pricing_rules.md
│   └── note_demo.md
├── tools/
│   └── ingest_pdf.md      # Runbook semi-automatico
└── _raw/                  # PDF originali (gitignored)
    └── .gitignore
```

**Convenzioni nelle pagine wiki** (definite in `CLAUDE.md`):
- Frontmatter YAML obbligatorio: `id`, `title`, `audience: public|internal`, `topics: [...]`, `updated_at`, `source_pdf`
- Stile: bullet-first, max ~200 parole per pagina
- Cross-link: `[[slug]]`
- No marketing fluff, dati concreti

**Workflow di ingest** (semi-automatico):
1. PDF viene salvato in `_raw/`
2. Si estrae il testo (`pdftotext` o equivalente)
3. Si chiede a Claude (con prompt-template definito) di produrre N pagine wiki strutturate
4. Revisione umana, correzione, commit
5. Aggiornamento di `index.md` e `log.md`

Inoltre aggiornare `SPECS/07_AI_Engine.md` sostituendo la sezione "Layer 3 Strict RAG / pgvector" con "Wiki-in-prompt + prompt caching".

**Criterio di accettazione**: 1 PDF reale convertito in ≥5 pagine `public/` + 1 `internal/`, `index.md` rigenerato, `log.md` aggiornato.

---

### F2 — Database — 2-3 ore

Creare il file `OUTPUT/postgres/migrations/2026_05_pilot_ai.sql` (nuova sottocartella `migrations/`; **non** modificare `kyros_schema.sql` che è lo snapshot iniziale).

**Nuove tabelle:**

```sql
ai_conversations (
  id UUID PK uuid_generate_v7(),
  session_id UUID UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  wiki_version VARCHAR(20),
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ
)

ai_messages (
  id UUID PK,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) CHECK IN ('user','assistant','system'),
  content TEXT,
  tokens_in INT,
  tokens_out INT,
  model VARCHAR(40),
  latency_ms INT,
  flags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)

ai_summaries (
  id UUID PK,
  conversation_id UUID UNIQUE REFERENCES ai_conversations(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment SMALLINT CHECK IN (-1, 0, 1),
  flags JSONB DEFAULT '[]',
  model VARCHAR(40),
  status VARCHAR(20) DEFAULT 'pending',  -- pending|ready|error
  generated_at TIMESTAMPTZ
)
```

**Modifica a `sessions`:** aggiungere `ai_conversation_id UUID REFERENCES ai_conversations(id)` per join veloce dalla Control Room.

**Indici:**
- `idx_ai_messages_conv ON ai_messages(conversation_id, created_at)`
- `idx_ai_summaries_status ON ai_summaries(status) WHERE status='pending'`

Aggiornare `SPECS/04_Database.md` con sezione "AI Pilot Tables".

**Criterio**: migrazione applicata via lo script PowerShell esistente, FK verificate.

---

### F3 — Chat real-time (gateway + n8n) — 1-2 giorni

**Microservizio nuovo: `OUTPUT/ai-gateway/`** (Node 20 + Express, ~200 righe)

```
OUTPUT/ai-gateway/
├── src/
│   ├── index.ts            # Server SSE, endpoint /chat/stream
│   ├── wiki-loader.ts      # Carica knowledge/public/*.md, cache in-memory
│   ├── anthropic-client.ts # Messages API + cache_control ephemeral + stream
│   ├── guardrail.ts        # Input checks (length, blacklist, jailbreak hints)
│   └── persistence.ts      # POST a n8n /internal/ai/persist-turn
├── prompts/
│   ├── system_chat.md      # Persona da SPECS/07_AI_Engine.md
│   └── system_summary.md   # Per F4
├── package.json
└── Dockerfile
```

**Nuovi workflow n8n:**
- `OUTPUT/n8n/025_API_Client_Chat_Bootstrap.json` — `POST /api/v1/client/chat/start`. Auth → crea/recupera `ai_conversation` → ritorna `conversation_id` + URL del gateway
- `OUTPUT/n8n/026_WEBHOOK_AI_Persist_Turn.json` — endpoint interno chiamato dal gateway per persistere ogni turno (user e assistant)

**Frontend:**
- Nuovo helper `OUTPUT/pwa/UNIFIED/src/lib/chatStream.ts` con `fetch + ReadableStream + TextDecoder` (no `EventSource`: serve un `POST`)

**Flusso:**
1. Frontend chiama n8n `/chat/start` → ottiene `conversation_id`
2. Frontend apre stream verso il gateway
3. Gateway: carica wiki pubblico (cached), prompt caching su system, stream da Anthropic, forwards al client
4. In parallelo: gateway fa POST a n8n con i turni → n8n li scrive in `ai_messages`

**Criterio**: TTFT < 1.5s su prompt cached, turno persistito, conversazione recuperabile via session refresh.

---

### F4 — Summary + sentiment async — mezza giornata

**Nuovo workflow** `OUTPUT/n8n/027_JOB_Conversation_Summary.json`
- Trigger: webhook interno `POST /internal/ai/summarize` con `conversation_id`
- SELECT degli ultimi N messaggi
- Chiamata Haiku 4.5 con structured output JSON: `{summary: string, sentiment: -1|0|1, flags: string[]}`
- INSERT in `ai_summaries` (`status='ready'`)

**Modifica al workflow esistente** `OUTPUT/n8n/014_API_Admin_CallNext.json` (verificare il nome esatto): aggiungere un nodo HTTP "fire-and-forget" verso `/internal/ai/summarize` subito dopo che la sessione passa a `called`.

**Modifica al workflow esistente** `017_API_Admin_GetQueueStatus.json` (verificare nome): includere nel payload `ai_summary` (LEFT JOIN su `ai_summaries`). Il polling esistente della `ControlRoom.tsx` lo legge **senza bisogno di Socket.io**.

**Criterio**: dopo "Call Next" entro ~5s il summary appare in Control Room via polling.

---

### F5 — UI cliente: ChatPanel — 1-2 giorni

**Componenti nuovi in `OUTPUT/pwa/UNIFIED/src/`:**
- `components/chat/ChatPanel.tsx` — bottom sheet collassabile (stile WhatsApp), integrato in `WaitingRoom.tsx`
- `components/chat/ChatMessage.tsx` — bubble user/assistant, stato "typing..."
- `components/chat/ChatComposer.tsx` — textarea + send, disabled durante stream
- `store/useChatStore.ts` — Zustand: `messages[]`, `streaming`, `error`, `conversationId`, methods `appendUserMessage`, `appendStreamChunk`, `finalizeAssistant`, `reset`
- `lib/chatStream.ts` — helper SSE (vedi F3)
- `types/chat.ts`

**Modifica:** `routes/client/WaitingRoom.tsx` — inserire `<ChatPanel sessionId={sessionId} />`, reset chat su `clearSession`.

**Riusi:** `components/shared/Button.tsx`, design tokens in `index.css` (slate-900, teal-400), `lucide-react`.

**Criterio**: chat utilizzabile in coda, streaming visibile, Glass Card coerente, gestiti stati empty/loading/error.

---

### F6 — UI admin: ContextSummaryCard — mezza giornata

**Nuovi file:**
- `components/admin/ContextSummaryCard.tsx` — card con summary breve, sentiment badge colorato (verde/giallo/rosso = +1/0/-1), flag chips. Stati: loading, ready, no-data.
- estendere `types/admin.ts` con `Customer.ai_summary?: { summary, sentiment, flags, status }`

**Modifiche:**
- `routes/admin/modes/CounterMode.tsx` — mostrare la card sopra il customer chiamato
- `lib/api/admin.ts` — estendere il tipo di `getQueueStatus` per includere `ai_summary`

**Criterio**: al click "Call Next" la card appare entro ~5s (somma del polling + tempo di generazione summary), sentiment colorato corretto.

---

### F7 — Tuning + test end-to-end — 1-2 giorni

**Nuovi file:**
- `OUTPUT/tests/e2e/pilot_ai_flow.md` — runbook manuale dei 3 scenari demo
- `OUTPUT/tests/scripts/seed_demo_conversation.ps1` — utility per testare il summary

**Attività:**
- Misurare TTFT (target < 1.5s su 20 query in sequenza)
- Iterare la struttura wiki: split pagine troppo lunghe, aggiungere cross-link
- Tarare i guardrail (ridurre false positives)
- **Test privacy critico**: tentare jailbreak per far citare contenuti `internal/` — verificare che fallisca sistematicamente

**3 scenari demo che devono passare review:**
1. **Cliente curioso**: chiede orari, prodotti, info — risposte accurate dal wiki
2. **Cliente frustrato**: descrive un problema con un reso — sentiment correttamente -1, summary cattura il punto
3. **Cliente fuori scope**: chiede cose non nella KB — l'AI ammette di non sapere ("Layer 3 Grounding" del 07_AI_Engine)

---

## 8. Sequenza e dipendenze

```
F1 (Wiki)        ─┐
                  ├─→ F3 (Chat) ─┬─→ F5 (UI cliente)
F2 (DB)          ─┘              │
                                 └─→ F4 (Summary) ─→ F6 (UI admin)

F5, F6 ──→ F7 (Tuning + Test)
```

F1 e F2 in parallelo (non c'è dipendenza). F3 ha bisogno di entrambi (wiki da caricare + tabelle dove scrivere). F4 dipende dai turni che F3 persiste. F5 dal gateway di F3. F6 dal summary di F4. F7 chiude.

---

## 9. Critical files (riepilogo)

### Da creare ex-novo

- `knowledge/CLAUDE.md`, `knowledge/index.md`, `knowledge/log.md`
- `knowledge/public/*.md`, `knowledge/internal/*.md`
- `knowledge/tools/ingest_pdf.md`
- `OUTPUT/postgres/migrations/2026_05_pilot_ai.sql`
- `OUTPUT/n8n/025_API_Client_Chat_Bootstrap.json`
- `OUTPUT/n8n/026_WEBHOOK_AI_Persist_Turn.json`
- `OUTPUT/n8n/027_JOB_Conversation_Summary.json`
- `OUTPUT/ai-gateway/` (intero microservizio Node)
- `OUTPUT/pwa/UNIFIED/src/components/chat/ChatPanel.tsx` (+ `ChatMessage`, `ChatComposer`)
- `OUTPUT/pwa/UNIFIED/src/store/useChatStore.ts`
- `OUTPUT/pwa/UNIFIED/src/lib/chatStream.ts`
- `OUTPUT/pwa/UNIFIED/src/types/chat.ts`
- `OUTPUT/pwa/UNIFIED/src/components/admin/ContextSummaryCard.tsx`

### Da modificare

- `SPECS/07_AI_Engine.md` (rimuovere pgvector, aggiungere wiki approach)
- `SPECS/04_Database.md` (aggiungere sezione "AI Pilot Tables")
- Workflow n8n `CallNext` esistente (aggiungere trigger summary fire-and-forget)
- Workflow n8n `GetQueueStatus` esistente (LEFT JOIN su `ai_summaries`)
- `OUTPUT/pwa/UNIFIED/src/routes/client/WaitingRoom.tsx` (integrare ChatPanel)
- `OUTPUT/pwa/UNIFIED/src/routes/admin/modes/CounterMode.tsx` (integrare SummaryCard)
- `OUTPUT/pwa/UNIFIED/src/lib/api/admin.ts`, `types/admin.ts` (estensioni tipi)

### Da riusare (già esistenti)

- `OUTPUT/n8n/005_Response_Standardizer.json` (SUB)
- `OUTPUT/n8n/006_Auth_Manager.json` (SUB)
- Polling pattern in `WaitingRoom.tsx:93` e `ControlRoom.tsx`
- `OUTPUT/pwa/UNIFIED/src/components/shared/Button.tsx`
- Design tokens in `index.css`

---

## 10. Verification end-to-end

Test sequenziali al termine di tutte le fasi:

1. **Wiki pipeline (F1)**: convertire 1 PDF reale → `knowledge/public/` popolato + `index.md` aggiornato → leggibilità wiki ok a occhio
2. **DB (F2)**: migrazione applicata senza errori → `SELECT FROM ai_conversations, ai_messages, ai_summaries` funziona → FK su `sessions.ai_conversation_id` ok
3. **Chat happy path (F3+F5)**: cliente entra in coda → apre chat → invia "che orari fate?" → streaming visibile entro 1.5s → risposta corretta dal wiki → turno persistito in `ai_messages`
4. **Summary path (F4+F6)**: admin clicca "Call Next" → entro ~5s la Control Room mostra summary + sentiment badge corretto
5. **Privacy test (F7)**: jailbreak attempt → l'AI non rivela mai contenuti da `internal/`
6. **Performance (F7)**: TTFT mediano su 20 query < 1.5s con prompt caching attivo
7. **Recovery**: refresh pagina cliente durante chat → conversazione si recupera

---

## 11. Decisioni aperte / da riconfermare

Punti su cui l'owner potrebbe voler tornare nella prossima discussione:

1. **AI Gateway: microservizio separato o tentare con n8n nativo?**
   La mia raccomandazione è il microservizio (semplifica streaming SSE), ma significa introdurre un nuovo componente da deployare. Alternative:
   - Tentare con il nodo `Respond to Webhook` di n8n in streaming mode (sperimentale)
   - Hostare il gateway nello stesso container del frontend o di n8n

2. **Privacy e provider LLM**: per uso interno demo è ragionevole usare l'API Anthropic, ma se i PDF `internal/` contengono informazioni davvero sensibili (es. pricing strategici, dati personali dipendenti) andrebbe valutato un modello self-hosted (Ollama / vLLM con Llama o Qwen). Da chiarire **cosa c'è effettivamente nell'`internal/`** prima dell'implementazione.

3. **Quante volte ricaricare il wiki?**
   - Opzione A: cache in-memory nel gateway, invalidata via `mtime` dei file → semplice, ok per demo
   - Opzione B: webhook di reload manuale (`POST /admin/wiki/reload`) → più controllato
   La raccomandazione è A per ora.

4. **Lingua della chat**: il default del progetto è italiano (`language: 'it'`). Il system prompt va scritto in italiano, ma i wiki potrebbero essere multi-lingua se i PDF lo sono. Da confermare scopa per il demo.

5. **Numero di turni di conversazione**: serve un cap (es. max 30 turni) per evitare contesti esplosivi? Probabilmente sì, ma è dettaglio implementativo.

6. **Costo previsto della demo**: con prompt caching e Haiku 4.5, una conversazione tipica (5-10 turni + 1 summary) costa nell'ordine dei pochi centesimi. Per una demo interna è trascurabile, ma vale la pena impostare un budget cap sull'API key.

7. **Rate limiting** della chat: per la demo non serve, ma in production servirebbe. Da rimandare.

---

## 12. Istruzioni per la prossima sessione

> **A Claude (o altro agente) che riceve questo documento:**
>
> Questo è un piano **da rivedere insieme all'owner Gualtiero Brazzelli**, non da eseguire direttamente. L'owner vuole:
>
> 1. Rileggere il documento e ridiscutere le decisioni (specialmente quelle in §11)
> 2. Eventualmente fare modifiche al piano prima di partire
> 3. Solo dopo conferma esplicita, iniziare l'implementazione
>
> **Prima di partire con l'implementazione**, fai sempre:
> - Verifica che i workflow n8n che pensi di modificare abbiano davvero i nomi che hai assunto (i numeri tipo `014_` o `017_` vanno controllati: erano stati ipotizzati da una sessione precedente che non li ha letti tutti uno per uno)
> - Conferma con l'owner il numero esatto di PDF e i loro nomi/topic, così pre-pari i placeholder `public/*.md` con le pagine giuste
> - Conferma se l'AI gateway debba essere containerizzato a parte o no
>
> **Non implementare in plan mode.** Aspetta che l'owner ti dica esplicitamente "ok, possiamo procedere".

---

## 13. Appendice: contesto della conversazione originaria

L'owner aveva precisato:
- *"Non voglio toccare nulla"* (siamo in fase di pianificazione, non implementazione)
- *"Studiamo un po' se quanto avevamo detto è ancora valido o possiamo farci venire in mente un'idea migliore"* (esplicito mandato di rivisitare il piano precedente)
- *"Discutiamo prima le idee e poi eventualmente scriveremo un piano"* (conversazione iterativa, non one-shot)

Claude ha esplorato il codebase per verificare lo stato reale (24 workflow n8n, schema PG, frontend React 19 con polling) e ha confrontato il piano `SPECS/07_AI_Engine.md` (RAG con pgvector) con il pattern LLM Wiki di Karpathy.

La conclusione è che, dato il **profilo del corpus (3-5 PDF) e dello use case (demo interna)**, l'approccio Wiki è tecnicamente superiore: meno infrastruttura, meno costo a query (con prompt caching), più debuggabile, più veloce da implementare (~3-5 giorni in meno).

Il piano è stato quindi rivisto da "RAG + pgvector + embeddings" a "Wiki pre-compilato + prompt caching + AI gateway leggero", mantenendo invariati gli obiettivi funzionali della fase Pilot (chat cliente, summary admin, sentiment).

---

**Fine documento.**
