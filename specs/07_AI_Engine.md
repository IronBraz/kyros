# 07 - AI Engine & Guardrails Specification

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
*   **Strict RAG (Retrieval-Augmented Generation):** L'AI risponde **SOLO** basandosi sulla Knowledge Base vettoriale fornita (Policy resi, Catalogo, Info Store).
*   **Gestione dell'Ignoranza:** Se l'informazione non è nel Vector DB, l'AI deve ammetterlo: "Non ho questa informazione specifica, ma posso annotarla per il collega che ti servirà a breve."

## 4. Gestione Sentiment (Escalation Asincrona)

Non salviamo vite, ma miglioriamo il servizio.

*   **Analisi Real-time:** Ogni messaggio utente viene analizzato per Sentiment (Positivo, Neutro, Negativo/Rabbia).
*   **Azione su Sentiment Negativo:**
    *   L'AI mantiene la calma e usa tecniche di de-escalation ("Mi dispiace che tu stia riscontrando questo problema...").
    *   **NO Allarmi in tempo reale.**
    *   **Staff Note:** Il sistema aggiunge un **Flag** o una **Nota** visibile sulla Dashboard dello Staff *solo* quando tocca il turno del cliente (es. ⚠️ *Cliente segnalato come frustrato per problemi di reso*).
    *   *Obiettivo:* Preparare psicologicamente l'addetto alla vendita per gestire un cliente difficile.

## 5. Performance Thresholds

L'esperienza deve essere fluida come una chat WhatsApp.

*   **Time to First Token (TTFT):** < 1.5 secondi (Obbligatorio streaming della risposta).
*   **Risposta Completa:** Entro 4-5 secondi max.
*   **Caching Semantico:** Le domande frequenti (es. "A che ora chiudete?", "Dov'è il bagno?") devono bypassare l'LLM e ricevere risposta immediata dalla cache (0.1s).

## 6. Stack Tecnologico (Ipotesi)

*   **Orchestrator:** n8n (Chain logic).
*   **LLM Model:** Modelli veloci ed economici (es. GPT-4o-mini, Claude 3 Haiku) per la chat real-time. Modelli più capaci (es. GPT-4o) solo per analisi complesse asincrone.
*   **Vector DB:** Postgres con `pgvector` (coerente con stack attuale).
*   **Embeddings:** OpenAI `text-embedding-3-small` o equivalenti open-source locali se privacy-critical.

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
