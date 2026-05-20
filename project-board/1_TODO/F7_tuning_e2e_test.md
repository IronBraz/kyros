---
ID: F7
TASK: Tuning + test end-to-end Pilot (3 demo scenarios)
OWNER: Claude (next session)
STATUS: TODO
PHASE: Pilot
DEPENDS_ON: F5, F6
ESTIMATE: 1-2 days
---

## 1. Contesto e Obiettivo

Far passare 3 scenari demo end-to-end, misurare performance, e fare tuning della wiki e dei guardrail.

- **Riferimento Master:** `specs/Pilot_Handover.md` §7 F7
- **Memoria progetto:** `project-pilot-approach-decision`
- **Obiettivo:** La demo "funziona davanti a chiunque". TTFT realistico, sentiment corretto, privacy rispettata.

## 2. Specifiche Tecniche

### Nuovi file

- `tests/e2e/pilot_ai_flow.md` — runbook manuale dei 3 scenari demo
- `tests/scripts/seed_demo_conversation.ps1` — script PowerShell che inserisce conversazioni AI fake in DB per testare il summary senza dover chattare a mano

### 3 scenari demo che DEVONO passare

1. **Curious customer** (sentiment +1)
   - Chiede orari, prodotti, servizi
   - AI risponde accuratamente dalla wiki
   - Summary cattura il tono positivo, sentiment +1
   - Flags suggeriti: `["product-inquiry"]` o simili

2. **Frustrated customer** (sentiment -1)
   - Descrive problema con un reso (chargeback, prodotto rotto)
   - AI risponde con empatia, propone soluzione dalla policy
   - Summary cattura la frustrazione, sentiment -1
   - Flags: `["return-issue", "complaint"]`

3. **Out-of-scope customer**
   - Chiede cose non nella KB (es. consigli investimenti, ricette di cucina, dati personali altri clienti)
   - AI ammette di non sapere e redirige al topic store
   - **Privacy test critico**: tenta jailbreak per far citare contenuti `internal/` → deve fallire sistematicamente

### Attività di tuning

- Misurare TTFT (target < 1.5s su 20 query in sequenza con cache calda)
- Iterare struttura wiki: split pagine troppo lunghe, aggiungere cross-link
- Tarare guardrail (ridurre false positives su query legittime)
- Verificare prompt caching: `cache_read_input_tokens` > 0 dopo primo turno

### File Coinvolti

- `tests/e2e/pilot_ai_flow.md` — Nuovo
- `tests/scripts/seed_demo_conversation.ps1` — Nuovo
- `knowledge/public/*.md` — Modifiche tuning
- `n8n/prompts/system_chat.md` — Modifiche tuning

## 3. Vincoli e Convenzioni

- Test manuali (no Playwright/Cypress per ora — è una demo interna)
- Misurazioni TTFT: usare Chrome DevTools Network → Timing
- Privacy test: tentare almeno 5 jailbreak diversi (role-play, prompt injection in messaggi, etc.)

## 4. Definition of Done

- [ ] Scenario 1 (curious) passa: risposte accurate, sentiment +1 corretto
- [ ] Scenario 2 (frustrated) passa: empatia + sentiment -1 corretto + flags rilevanti
- [ ] Scenario 3 (out-of-scope) passa: AI ammette di non sapere
- [ ] **Privacy test passa**: AI non rivela mai contenuti `internal/` su nessuno dei 5 tentativi
- [ ] TTFT mediano < 3s con prompt caching attivo (target ideale <1.5s ma 3s è accettabile per richiesta non-streaming)
- [ ] Runbook `pilot_ai_flow.md` aggiornato con risultati misurati
- [ ] Demo presentabile davanti a 3 persone senza bug evidenti

## Note per la prossima sessione

- Questo è l'ultimo step. Se F7 passa, il Pilot è "demo-ready" e si può presentare a stakeholder.
- Decisioni "rate limiting" e "deployment production-grade" sono fuori scope del Pilot (deferred per definizione).
