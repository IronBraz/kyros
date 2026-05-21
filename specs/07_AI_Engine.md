# 07 - AI Engine & Guardrails Specification

> **⚠️ Nota Pilot (2026-05-21)** — La persona qui sotto è scritta in **italiano** perché concepita in fase MVP/produzione. Per il **Pilot** (demo interna) la chat AI è in **English** (decisione owner 2026-05-20). Chi implementa il system prompt nel workflow n8n `026_API_Client_Chat_Send.json` (task F3) deve **tradurre la persona in inglese** e non copiare letteralmente le sezioni §2-§3 di questo documento. Inoltre la sezione "Layer 3 Strict RAG / pgvector" (se presente) è superseded dal pattern "LLM Wiki" (system prompt + prompt caching) — vedi `specs/Pilot_Handover.md` §5 e i task F1/F3.

## 1. Visione
L'AI Engine è la "mente" di Kyros. Non è un semplice chatbot, ma un **Digital Concierge** progettato per intrattenere, informare e preparare il cliente durante l'attesa.
La sua missione è trasformare il "tempo morto" della coda in "tempo di valore" (branding, info prodotti), agendo come un ambasciatore impeccabile del brand.

## 2. AI Persona (System Prompt Core)

Il "Character" deve essere coerente e brand-safe.

*   **Ruolo:** Concierge Esperto del Brand.
*   **Tono di Voce:**
    *   **Caldo ma Professionale:** Empatico, mai robotico, ma mantenendo una giusta distanza (non è un amico, è un assistente).
    *   **Sintetico:** Risposte brevi (max 2-3 frasi di default), ottimizzate per lettura su mobile in movimento.
    *   **Proattivo:** Non attende solo domande, ma offre spunti (se configurato).
*   **Prime Directive:** "Non mettere mai in cattiva luce il Brand, i suoi prodotti o i suoi partner."

## 3. Guardrails & Safety (Architettura a Strati)

Dobbiamo prevenire rischi reputazionali attraverso un sistema di sicurezza a "Cipolla".

### Layer 1: Input Sanitation (Tecnico)
*   Blocco preventivo di tentativi di **Jailbreak** (es. "Ignora le istruzioni precedenti...").
*   Filtro PII (Personally Identifiable Information): L'AI avvisa l'utente di non condividere dati sensibili (carte di credito, password) in chat.

### Layer 2: Semantic Guardrails (Contenuto)
Utilizzo di librerie di controllo (es. NeMo Guardrails o logica custom su n8n) per gestire topic critici:

1.  **Competitor Shield (Pivot Strategy):**
    *   *Input Utente:* "Da Zara questa maglia costa la metà."
    *   *Risposta Errata:* "Sì ma la loro qualità è bassa." (Attacco = Rischio).
    *   *Risposta Corretta:* "Capisco il confronto sul prezzo. I nostri capi però utilizzano cotone organico certificato che garantisce una durata doppia nel tempo." (Pivot sul Valore).
2.  **Blacklisted Topics:** Politica, Religione, Sesso, Violenza, Attività Illegali.
    *   *Reazione:* Glissare elegantemente. "Preferisco concentrarmi su come rendere perfetta la tua esperienza in store oggi."

### Layer 3: Grounding (Anti-Allucinazioni)

> **⚠️ Pilot implementation** — The approach below supersedes pgvector/RAG. See `specs/Pilot_Handover.md` §5 and tasks F1/F3.

*   **Wiki-in-prompt (LLM Wiki / Karpathy approach):** The AI responds **ONLY** based on `knowledge/public/` markdown pages loaded directly into the system prompt on every request. No vector database, no embeddings, no chunking pipeline.
*   **Prompt Caching:** Wiki content is sent with `cache_control: ephemeral` (Anthropic prompt caching) to reduce cost across conversation turns. Cache TTL: 5 minutes.
*   **Knowledge Scope:** Only `knowledge/public/` is included — `knowledge/internal/` is never sent to the client AI.
*   **Wiki Reload:** Triggered manually via the Admin Settings panel (task F8) or on n8n server startup. Deterministic, not dynamic per-request.
*   **Handling Unknown Information:** If the question is outside the wiki scope: *"I don't have that specific information, but the team member who serves you will be happy to help."*

## 4. Gestione Sentiment (Escalation Asincrona)

Non salviamo vite, ma miglioriamo il servizio.

*   **Analisi Real-time:** Ogni messaggio utente viene analizzato per Sentiment (Positivo, Neutro, Negativo/Rabbia).
*   **Azione su Sentiment Negativo:**
    *   L'AI mantiene la calma e usa tecniche di de-escalation ("Mi dispiace che tu stia riscontrando questo problema...").
    *   **NO Allarmi in tempo reale.**
    *   **Staff Note:** Il sistema aggiunge un **Flag** o una **Nota** visibile sulla Dashboard dello Staff *solo* quando tocca il turno del cliente (es. ⚠️ *Cliente segnalato come frustrato per problemi di reso*).
    *   *Obiettivo:* Preparare psicologicamente l'addetto alla vendita per gestire un cliente difficile.

## 5. Performance Thresholds

> **Pilot note**: Streaming is NOT implemented (decision #1, 2026-05-20). Chat is request-response (POST → full reply). A WhatsApp-style typing indicator (●●●) covers the 3–5 s wait.

*   **Full Response Time:** Target 3–5 seconds (Haiku 4.5, ~2k token context with cached wiki)
*   **Typing Indicator:** Shown immediately on send; hidden when response arrives (task F5)
*   **Semantic Cache:** Not implemented in Pilot — full wiki is always loaded via prompt caching

## 6. Stack Tecnologico (Pilot)

*   **Orchestrator:** n8n (direct Anthropic API call — no gateway microservice, decision #1)
*   **LLM Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — fast and economical
*   **Knowledge Store:** Markdown files in `knowledge/public/` (wiki-in-prompt, no pgvector)
*   **Prompt Caching:** Anthropic `cache_control: ephemeral` on wiki content block
*   **Budget Cap:** Hard kill-switch at €3/month via `ai_usage_monthly` table (tasks F3/F8)
*   **No streaming:** request-response pattern; typing indicator covers wait (task F5)
*   **No pgvector / embeddings:** deferred to production scale-up if corpus grows beyond LLM context

## 7. Roadmap Funzionalità AI

### FASE 1 - MVP (Placeholder)
*   AI non attiva o regole statiche (chatbot a bottoni).

### FASE 2 - PILOT (Il Concierge Attivo)
*   Attivazione RAG su documenti base (Orari, Policy, FAQ).
*   Guardrails attivi.
*   Analisi Sentiment base (Nota per lo Staff).

### FASE 3 - SCALE-UP (Smart Features)
*   **Context Awareness:** Suggerimenti basati su Meteo, Orario, Storico acquisti.
*   **Gamification:** Quiz o intrattenimento se la coda supera X minuti.
*   **Soft Selling:** Proposte prodotti contestuali ("Mentre aspetti, hai visto la vetrina X?").
