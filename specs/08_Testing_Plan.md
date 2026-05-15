# Kyros - Piano di Testing & Validazione (MVP)

**Ambito:** Quality Assurance (QA), Stress Test e User Acceptance Testing (UAT).
**Riferimenti:** Verifica i requisiti di `01_Vision_e_Business.md` e `03_Architettura_Funzionale.md`.

---

## 1. Strategia di Testing (Extreme MVP)
Il focus è sulla stabilità del flusso FIFO e sulla resilienza della connessione WebSocket tra Cliente e Cassa.

### A. Scenario A: Il Cliente Standard
1.  Scan QR Entry Point.
2.  Emissione Ticket.
3.  Verifica Carosello Marketing (testo e icone).
4.  Ricezione Chiamata (Audio/Vibrazione).

### B. Scenario B: Gestione Cassa (Staff)
1.  Apertura Control Room e selezione Sportello (es. "Cassa 1").
2.  Chiamata "Prossimo" via tasto SPAZIO.
3.  Gestione "Non Risponde" e Recall.
4.  Verifica Analytics per lo sportello attivo.

### C. Scenario C: Resilience (Stress Test)
1.  **Concorrenza**: Due casse chiamano contemporaneamente (Verifica Lock DB).
2.  **Network**: Disconnessione e riconnessione WebSocket del cliente.
3.  **Janitor**: Verifica cancellazione automatica ticket "Ghost" dopo 15 min.

---

## 2. Casi di Test Tecnici (T-Series)
| ID | Descrizione | Risultato Atteso |
| :--- | :--- | :--- |
| **T1** | Emissione Ticket UUIDv7 | Sequenzialità perfetta nel DB. |
| **T2** | Notifica Push Fallback | Ricezione notifica anche con browser in background. |
| **T3** | Reset Coda | Azzeramento sessioni attive da pannello Admin. |
| **T4** | Login Gate | Accesso negato con PIN errato, accesso consentito con PIN corretto. |
| **T5** | Queue Toggle | Cliente vede "Closed" se toggle è OFF. |
| **T6** | Sound Autoplay | Suono "Call" riprodotto correttamente dopo interazione iniziale. |

---

## 3. User Acceptance Testing (UAT)
*   **Test di Semplicità**: Un utente non tecnico deve essere in grado di configurare un nuovo sportello e stampare il QR in meno di 2 minuti.
*   **Test Visivo**: Il carosello marketing deve apparire armonioso anche senza immagini, usando la palette colori predefinita.

---

## 6. Checklist Pre-Lancio (Go/No-Go)
- [ ] Database Schema migrato e pulito (niente dati test).
- [ ] HTTPS attivo e certificati validi.
- [ ] QR Code stampati e leggibili da 3 diversi telefoni (iOS/Android/Low-end).
- [ ] Audio notifiche testato in ambiente rumoroso.
- [ ] Backup automatico configurato.