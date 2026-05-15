# Kyros - Architettura Funzionale (Fase 1)

**Ambito:** Flussi logici, User Journey e Regole di Business.
**Riferimenti:** Allineato alla Roadmap in `01_Vision_e_Business.md`.

---

## 1. Modello Concettuale
Kyros Fase 1 gestisce il flusso fisico dei clienti all'interno di un singolo store organizzato per aree e servito da più postazioni (casse).

*   **Entità**:
    *   **Store**: Il punto vendita fisico.
    *   **Entry Point**: Punto di ingresso digitale (QR/NFC) situato in una zona specifica.
    *   **Service Point**: Postazione fisica (Cassa/Desk) dove avviene il servizio.
    *   **Sessione**: L'istanza digitale dell'attesa di un cliente (anonima).

---

## 2. Flussi Utente Dettagliati (Fase 1)

### A. Journey del Cliente (PWA) - "The Concierge Experience"

#### A.1 Session Recovery (Persistenza & Riconnessione)

Il sistema deve garantire continuità anche in caso di refresh della pagina o chiusura accidentale del browser.

**Strategia di Persistenza (Client-Side):**
1.  **Storage**: `localStorage` con chiave `kyros_session` contenente `session_id`, `ticket_code`, `store_id`.
2.  **Flow di Recovery**:
    *   All'apertura, l'app controlla il `localStorage`.
    *   Se esiste una sessione attiva, chiama `GET /api/v1/client/sessions/:id`.
    *   Se lo stato è `waiting` o `called`, ripristina la Waiting Room.
    *   Se lo stato è finale (`served`, `abandoned`, `missed`), pulisce lo storage e mostra la landing.

### B. Journey Staff & Admin (Kyros Control Room)
L'interfaccia operativa per chi smaltisce la coda da una postazione fisica.

#### 0. Accesso (Gate)
*   **Login**: Inserimento PIN numerico (definito nello store settings).
*   **Sessione**: Persistente per 8 ore (permette refresh senza ri-login).

#### 1. Counter Mode
*   **Selezione Postazione**: Lo staff seleziona la **Cassa** specifica.
*   **FIFO Pool**: La chiamata segue l'ordine cronologico globale dello store.
*   **Action Principale**: Pulsante "Chiama Prossimo" (Electric Teal).

---

## 3. Regole di Business (MVP)
*   **Logica di Smistamento**: FIFO (First-In, First-Out) globale per lo store.
*   **Gestione Concorrenza**: Lock DB (`FOR UPDATE SKIP LOCKED`) per evitare che due operatori chiamino lo stesso cliente.
*   **Janitor Policy**: Pulizia automatica delle sessioni senza heartbeat (15 min) o chiamate e mai presentatesi (5 min).

---

## 4. Predisposizione AI (Future-Proofing)
*   **Hybrid Feed**: Il carosello accetta Card Statiche + Card Dinamiche iniettate dall'AI.
*   **Context Summary**: Area placeholder per suggerimenti RAG basati sulla sessione corrente.