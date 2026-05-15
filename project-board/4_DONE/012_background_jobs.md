---
ID: 012
TASK: Implementare 2 Background Jobs n8n
OWNER: Claude
STATUS: DONE
COMPLETED: 2025-12-31
---

**COSA:** Creare 2 workflow automatici: Janitor (cleanup ghost sessions ogni 5 min) + Daily Reset (reset ticket sequences 00:05)

**PERCHÉ:** Sessioni ghost (client chiude browser senza abandon) restano "waiting" per sempre. Ticket sequences deve resettarsi ogni giorno a mezzanotte

**RISULTATO:**

- [x] JOB_Janitor → Cron */5 * * * * (ID: yODAaVQQh4V1AJg8)
  - Mark 'abandoned': waiting sessions senza heartbeat per 15+ min
  - Mark 'missed': called sessions non servite per 5+ min
  - Esecuzione parallela delle due query cleanup
  - Timezone: Europe/Rome
- [x] JOB_Daily_Reset → Cron 5 0 * * * (ID: 1eowwUo2417w4IIX)
  - Reset ticket_sequences: current_number=0, prefix='A'
  - Solo per stores con last_reset_date < CURRENT_DATE
  - Timezone: Europe/Rome
- [x] 2 file JSON esportati:
  - OUTPUT/n8n/018_JOB_Janitor.json
  - OUTPUT/n8n/019_JOB_Daily_Reset.json

**Riferimenti:**
- SPECS/03_Architettura_Funzionale.md § Janitor Policy
- SPECS/04_Database.md § ticket_sequences

**Note & Log:**
- 2025-12-31: Entrambi i job usano Schedule Trigger con cron expression. Janitor esegue cleanup parallelo (abandoned + missed). Daily Reset a 00:05 per evitare conflitti con midnight rollover.
