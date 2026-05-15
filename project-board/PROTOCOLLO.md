# PROTOCOLLO DI SVILUPPO "KYROS ATOMIC KANBAN" (v2.2)

Questo documento definisce le regole operative per il team Kyros (Gualti, Gemini, Claude). L'obiettivo è garantire un flusso di lavoro orchestrato, tracciabile e privo di conflitti, utilizzando il file system come unica fonte di stato.

---

## 1. La Gerarchia della Verità (Cascata di Responsabilità)

In caso di incongruenze, vige la seguente gerarchia:
1.  **GEMINI.md**: Identità e regole d'ingaggio fondamentali.
2.  **SPECS/ (Sorgente di Verità)**: `01_Vision_e_Business.md`, `03_Architettura_Funzionale.md`, `04_Database.md`.
3.  **PROTOCOLLO.md**: Questo file (Il "Come").
4.  **Codice Sorgente**: L'implementazione fisica.

---

## 2. Struttura della Board (Kanban File-System)

Il progetto è gestito tramite la struttura di cartelle `PROJECT_BOARD/`. Lo stato di un task è definito dalla sua posizione fisica.

- `0_BACKLOG/`: Idee e task a lungo termine.
- `1_TODO/`: Task pronti per essere lavorati, prioritizzati.
- `2_IN_PROGRESS/`: **Lock Attivo.** Massimo un task per agente AI.
- `3_PENDING_REVIEW/`: Task completati in attesa di approvazione.
- `4_DONE/`: Task approvati e conclusi.
- `5_BLOCKED/`: Task fermi (motivo specificato nel file).

---

## 3. Protocolli Operativi Dettagliati (The Engine)

### Protocollo #1: Decomposizione e Creazione Task (Resp: Agente AI)
1.  A seguito di una richiesta di alto livello di Gualti, l'agente la scompone in task tecnici, atomici e realizzabili.
2.  L'agente genera i file `.md` in `1_TODO/` con ID progressivo (es. `001_descrizione.md`) e `OWNER: Unassigned`.
3.  L'agente comunica a Gualti l'avvenuta creazione.

### Protocollo #2: Presa in Carico (Resp: Agente AI - Anti Race Condition)
1.  L'agente identifica il task con ID più basso in `1_TODO/`.
2.  **Verifica**: Controlla che il file sia ancora `Unassigned`.
3.  **Update (Fase 1)**: Modifica il file impostando `OWNER: [Nome]` e `STATUS: IN_PROGRESS`.
4.  **Lock (Fase 2 - Move Atomico)**: Sposta il file in `2_IN_PROGRESS/`. 
    - *Successo*: Il lock è acquisito. L'agente inizia il lavoro.
    - *Fallimento*: Se il file non esiste più (spostato da altri), l'agente abortisce e torna al punto 1.

### Protocollo #3: Completamento e Revisione (Resp: Agente AI)
1.  Verifica che tutti gli **Acceptance Criteria** siano soddisfatti.
2.  Aggiunge note finali o log nella sezione `Note & Log:`.
3.  Aggiorna `STATUS: PENDING_REVIEW` e sposta il file in `3_PENDING_REVIEW/`.
4.  Notifica Gualti per la revisione.

### Protocollo #4: Ciclo di Approvazione (Resp: Gualti)
1.  Gualti esamina il lavoro.
2.  **Caso A (Approvazione)**: Gualti dice "**Approvo task [ID]**". L'agente aggiorna `STATUS: DONE` e muove in `4_DONE/`.
3.  **Caso B (Rifiuto)**: Gualti fornisce feedback. L'agente documenta il motivo, imposta `STATUS: TODO` e sposta il file in `1_TODO/` per ri-pianificazione.

### Protocollo #5: Gestione dei Blocchi (Resp: Agente AI e Gualti)
1.  Se un agente è bloccato, aggiunge `BLOCKER_REASON: <descrizione>` nel file.
2.  Aggiorna `STATUS: BLOCKED` e sposta il file in `5_BLOCKED/`.
3.  Gualti risolve il blocco dicendo "**Sblocca task [ID]**". L'agente documenta la soluzione, imposta `STATUS: TODO` e riporta il file in `1_TODO/`.

---

## 4. Il Comando "SCRIVIORA" (Write-Lock Protocol)

L'azione di scrittura fisica sui file (Specs o Codice) avviene **SOLO** dopo il comando esplicito `SCRIVIORA` dell'utente, a seguito di un piano d'azione approvato.

---

## 5. Formato del Task (.md)

```markdown
---
ID: <numero_progressivo>
TASK: <titolo_breve>
OWNER: <Unassigned | NomeAgente>
STATUS: <TODO | IN_PROGRESS | PENDING_REVIEW | DONE | BLOCKED>
---
**Descrizione:** <Dettaglio tecnico>
**Acceptance Criteria:**
- [ ] Criterio 1
**Note & Log:** <Tracciabilità decisioni e modifiche>
```

---

## 6. Manutenzione
- **No Duplicazione**: Le Fasi del Progetto (MVP, PILOT, etc.) sono definite solo in `SPECS/01_Vision_e_Business.md`.
- **Backup**: La cartella `Backup/` è protetta e mai scansionata dai tool di sviluppo.
