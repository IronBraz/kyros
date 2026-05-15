# Kyros - Visione, Strategia e Roadmap

**Ambito:** Visione di alto livello, Strategia di Rilascio, Definizione dell'MVP e KPI.
**Riferimenti:** Documento "Stella Polare" per l'allineamento strategico.

---

## 1. Vision e Mission
*   **Visione**: Trasformare l'attesa passiva nel retail in un'esperienza interattiva e di valore, convertendo il tempo perso (Chronos) in opportunità di engagement (Kairos).
*   **Missione**: Fornire ai retailer uno strumento "Zero-Attrito" che digitalizza il flusso clienti, abilita il lavoro dello staff con dati contestuali e prepara il terreno per l'assistenza AI proattiva.
*   **Filosofia Prodotto**: 
    *   **Concierge, non Poliziotto**: Non gestiamo solo l'ordine, accogliamo il cliente.
    *   **Operatore al Centro**: La tecnologia potenzia lo staff, non lo sostituisce.
    *   **Data-Driven**: Ogni interazione genera insight per il management.

---

## 2. Roadmap Strategica
Il progetto segue un approccio incrementale in 3 fasi per mitigare i rischi e validare il valore.

### FASE 1: MVP - "Store Flow Foundation" (Il Nostro Focus Attuale)
**Obiettivo**: Validazione operativa e tecnica. Il sistema deve gestire perfettamente il flusso fisico dei clienti e fornire dati di base.
**Concept**: Una dashboard di gestione negozio che digitalizza l'ingresso e lo smistamento.
**Perimetro Funzionale**:
*   **Logica Coda**: FIFO (First-In-First-Served) su coda unica condivisa. Tutte le casse pescano dallo stesso "pool" di clienti.
*   **Interfacce**: PWA Cliente (Base), Dashboard Unificata (Manager + Operatore).
*   **No AI (Per ora)**: L'AI Concierge è presente solo come placeholder nella UI per abituare lo staff.

### FASE 2: PILOT - "The AI Concierge"
**Obiettivo**: Validazione del valore aggiunto.
**Add-on**:
*   Attivazione modulo RAG (Retrieval-Augmented Generation).
*   Chat interattiva per il cliente durante l'attesa.
*   "Context Summary" reale per l'operatore (sostituisce il placeholder).
*   **Passive Sentiment**: Analisi tono utente (Positivo/Neutro/Negativo) visibile all'operatore per contesto, senza alert invasivi.
*   **Routing**: Rigorosamente **FIFO**. L'AI intrattiene e qualifica, ma non altera l'ordine di arrivo.

### FASE 3: SCALE - "Ecosystem Integration"
**Obiettivo**: Validazione business e scalabilità.
**Add-on**:
*   **Ethical Smart Routing**: Gestione code multiple o prioritarie basate su *necessità* (es. "Appuntamenti" vs "Walk-in") o tipologia servizio, mai sul mero "valore" economico del cliente ("Voglio spendere" non salta la fila).
*   Integrazioni CRM/POS.
*   Analytics predittivi.
*   Gestione Multi-Tenant self-service.
*   App native (opzionale).

---

## 3. Specifiche di Dettaglio: FASE 1 (MVP)

### Dettaglio Tecnico: Gestione Ibrida NFC/QR (Entry Points)
Per massimizzare l'accessibilità e semplificare il setup operativo:
1.  **Entry Point Unico**: Ogni punto di ingresso (es. "Totem Ingresso") è un'entità unica nel sistema.
2.  **Vettori Multipli**: Lo stesso URL di onboarding può essere raggiunto via QR Code o Tag NFC.
3.  **Setup Semplificato**: Il Backoffice genera un "QR Writer": un QR code speciale contenente solo l'URL in formato testo. L'installatore usa un'App Android (es. NFC Tools) per leggere questo QR e scrivere rapidamente il Tag NFC senza digitare nulla.

### A. Kyros Control Room (Admin Unificato)
Il cuore del sistema per MVP e Pilot è un'applicazione Desktop Web (React) protetta da un semplice **Gate Code (PIN)**.

#### 1. Modulo Operativo (Counter)
*   **Accesso**: Protetto da PIN (Sessione locale persistente).
*   **Setup**: Selezione rapida dello Store e della Cassa dal menu contestuale.
*   **Action Principale**: Pulsante gigante "NEXT CUSTOMER" (o tasto SPAZIO).
*   **Waiting List**: Visualizzazione "Zen" della coda.
*   **Recall Drawer**: Pannello laterale per recuperare velocemente i clienti "Missed".

#### 2. Modulo Configurazione (Organization)
*   **Setup Guidato**: Wizard per creare Tenant > Store > Casse se il DB è vuoto.
*   **Zoning Rapido**: Generazione QR Code con label incorporata.

#### 3. Modulo Engagement (Content)
*   **Feed Manager**: Editor visuale con anteprima live per creare card promozionali o informative che appaiono sui telefoni dei clienti in attesa.

### B. PWA Cliente (Front-End)
*   **Onboarding**: Scansione QR -> Landing Page ("Benvenuto da Nespresso").
*   **Azione**: "Prendi il ticket virtuale".
*   **Stato**: Visualizzazione posizione e tempo stimato.
*   **Notifica**: Browser Notification / Vibrazione / Suono quando chiamato.

---

## 4. Metriche di Successo (KPI) & Ipotesi

### Ipotesi da Validare (Fase 1)
1.  **H1 (Adozione)**: I clienti sono disposti a scansionare un QR code invece di prendere un biglietto fisico cartaceo.
2.  **H2 (Usabilità Staff)**: Gli operatori trovano il pulsante digitale "Chiama" veloce quanto quello fisico.
3.  **H3 (Affidabilità)**: La PWA mantiene la connessione WebSocket stabile all'interno del negozio.

### KPI "Stella Polare"
| Metrica | Target MVP | Descrizione |
| :--- | :--- | :--- |
| **Adoption Rate** | > 15% ingressi | % di clienti totali che usano Kyros (vs flusso naturale). |
| **Retention Coda** | > 85% | % di clienti che aspettano la chiamata senza abbandonare. |
| **Staff Score** | > 7/10 | Voto medio degli operatori sulla facilità d'uso (Survey). |
| **Time-to-Call** | < 3 sec | Tempo tra click "Chiama" e notifica sul telefono del cliente. |

---

## 5. Rischi e Mitigazioni (Fase 1)
*   **Rischio**: Connettività cliente instabile nel negozio.
    *   *Mitigazione*: UI PWA "Resiliente" (mostra ultimo stato noto + timestamp, retry automatico).
*   **Rischio**: Complessità configurazione per il Manager.
    *   *Mitigazione*: Wizard "Primo Avvio" (Step 1: Crea Cassa, Step 2: Stampa QR).
*   **Rischio**: Hardware NFC PC assente.
    *   *Mitigazione*: Procedura "Mobile Write" documentata (Manager usa suo telefono per scrivere i tag con la stringa fornita dalla Dashboard).