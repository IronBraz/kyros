# Kyros - Analisi di Mercato e Contesto

**Ambito:** Utenti Tipo (Personas), Analisi della Concorrenza e Fattori di Differenziazione.
**Riferimenti:** Definisce chi sono gli utenti e come ci posizioniamo sul mercato.

---

## 2. Analisi di Mercato e Contesto
*   **Utenti Tipo (Personas)**: 
    *   **Profilo 1: Il Cliente - "Luca"**
        *   **Chi è**: 35 anni, appassionato di tecnologia e buon caffè. Entra nel negozio per comprare delle capsule, ma è incuriosito da una nuova macchina da caffè esposta.
        *   **Scenario**: Gli specialisti sono tutti occupati. Non vuole mettersi in una coda fisica solo per fare qualche domanda esplorativa, né vuole perdere la sua pausa pranzo in un'attesa indefinita.
        *   **Obiettivi**:
            *   Ottenere informazioni specifiche su un prodotto senza dover attendere un operatore solo per domande preliminari.
            *   Capire se l'investimento in una nuova macchina ha senso per lui.
            *   Ottimizzare il suo tempo, trasformando un'attesa potenzialmente morta in un momento utile.
        *   **Frustrazioni Attuali**:
            *   Le code disorganizzate e non sapere "a chi tocca".
            *   L'incertezza sulla durata dell'attesa.
            *   La sensazione di essere "bloccato" in un punto fisico senza potersi muovere nel negozio.
            *   Dover ripetere le sue esigenze a più persone.
        *   **Come il nostro sistema aiuta Luca**:
            *   Scansiona un QR vicino alla macchina da caffè, entrando in una coda "virtuale" contestualizzata.
            *   Visualizza subito una stima del tempo di attesa ("~5 minuti"), decidendo se ne vale la pena.
            *   Nell'attesa, può interagire con l'assistente AI per chiedere specifiche tecniche, confronti tra modelli o vedere recensioni, rendendo l'attesa produttiva.
            *   Quando viene chiamato, lo specialista sa già che Luca è interessato a quella specifica macchina e ha già fatto certe domande, rendendo la conversazione immediatamente efficace.

    *   **Profilo 2: Il Sales Assistant - "Sara"**
        *   **Chi è**: 28 anni, "Coffee Specialist". È appassionata del suo lavoro e ama consigliare i clienti, ma si sente sotto pressione durante le ore di punta.
        *   **Scenario**: È sabato pomeriggio, il negozio è pieno. Sta gestendo una vendita complessa con un cliente mentre con la coda dell'occhio vede altre tre persone in attesa che la guardano, senza sapere chi sia il prossimo o di cosa abbiano bisogno.
        *   **Obiettivi**:
            *   Fornire un servizio di alta qualità e consulenza personalizzata a ogni cliente.
            *   Gestire il flusso di clienti in modo ordinato ed equo, senza stress.
            *   Sentirsi in controllo del proprio lavoro, anche nei momenti di picco.
        *   **Frustrazioni Attuali**:
            *   L'ansia generata da una coda fisica di persone impazienti.
            *   Non sapere se il prossimo cliente ha bisogno di un'informazione da 30 secondi o di una consulenza da 15 minuti.
            *   Il caos nel gestire l'ordine di arrivo e le priorità.
            *   Perdere tempo a chiedere "di cosa ha bisogno?" invece di entrare subito nel vivo della consulenza.
        *   **Come il nostro sistema aiuta Sara**:
            *   Sul suo tablet/postazione, vede una lista ordinata di clienti in attesa.
            *   Con un singolo click su "Chiama il prossimo", il sistema notifica il cliente giusto.
            *   Accanto al nome di Luca, vede: "Area: Macchine, Interesse: Modello X, Ha chiesto: confronto con Modello Y".
            *   Questo contesto le permette di accogliere Luca con "Ciao, ho visto che sei interessato alla Modello X. Ottima scelta! Vediamo insieme se è quella giusta per te", trasformando l'interazione e facendola sentire una consulente proattiva, non una semplice commessa che gestisce una coda).

    *   **Profilo 3: Il Boutique Manager - "Elena"**
        *   **Chi è**: 42 anni, Store Manager di un flagship store di moda. È responsabile dei KPI del negozio, della turnazione dello staff e della configurazione del layout di vendita.
        *   **Scenario**: È lunedì mattina. Deve configurare il negozio per una "Flash Sale" pomeridiana. Sa che ci sarà afflusso, ma non vuole bloccare l'ingresso con transenne fisiche o sistemi rigidi.
        *   **Obiettivi**:
            *   Monitorare in tempo reale i flussi e i tempi di attesa per riallocare lo staff dove serve.
            *   Creare o modificare dinamicamente le "Aree di Coda" (punti di ingresso) in base alle necessità del giorno.
            *   Analizzare i dati storici per ottimizzare i turni e prevedere i picchi.
        *   **Frustrazioni Attuali**:
            *   Mancanza di dati sui "mancati acquisti" dovuti all'attesa eccessiva (abbandoni della coda).
            *   Difficoltà nel gestire la comunicazione verso i clienti quando i tempi di attesa si allungano improvvisamente.
            *   Sistemi eliminacode tradizionali che richiedono interventi tecnici esterni per ogni minima modifica.
        *   **Come il nostro sistema aiuta Elena**:
            *   Dashboard Store: Vede in tempo reale quante persone sono in attesa in ogni area e il tempo medio di smaltimento.
            *   Configurazione Agile: Può generare un nuovo QR Code per un'area specifica in pochi secondi, personalizzando il messaggio di benvenuto.
            *   Alerting: Riceve notifiche se un'area è congestionata, permettendole di agire tempestivamente prima che la frustrazione dei clienti aumenti.

    *   **Profilo 4: Il Platform Admin - "Alex"**
        *   **Chi è**: 30 anni, amministratore del sistema centralizzato per l'azienda fornitrice del servizio SaaS.
        *   **Scenario**: Deve attivare il servizio Kyros per una nuova catena di negozi ("BrandX") e configurare le loro prime 5 location nel sistema.
        *   **Obiettivi**:
            *   Garantire l'isolamento dei dati tra diversi clienti (Multi-tenancy).
            *   Gestire in modo centralizzato le entità aziendali e i relativi punti vendita.
            *   Monitorare lo stato di salute generale della piattaforma e dei servizi (AI, Database, Automazioni).
        *   **Frustrazioni Attuali**:
            *   Configurazioni manuali e ripetitive per ogni nuovo cliente.
            *   Rischio di cross-contamination dei dati tra diversi tenant.
            *   Difficoltà nel scalare l'infrastruttura per supportare migliaia di negozi contemporaneamente.
        *   **Come il nostro sistema aiuta Alex**:
            *   Multi-tenant Console: Crea con un click l'entità "BrandX" e assegna ad essa i permessi e le risorse necessarie.
            *   Gestione Gerarchica: Può visualizzare e gestire la struttura Azienda -> Negozio -> Area, mantenendo tutto ordinato e sicuro.
            *   Provisioning Automatizzato: Il sistema è progettato per gestire migliaia di tenant sulla stessa infrastruttura modulare (Docker), riducendo i costi di manutenzione e massimizzando l'efficienza).

*   **Soluzioni Esistenti**:
    Il mercato della gestione delle code e del "customer flow" è maturo e segmentato. Le soluzioni attuali possono essere raggruppate in tre categorie principali:

    *   **1. Sistemi a Bassa Tecnologia (Analogici)**
        *   **Descrizione**: Comprendono la coda fisica disorganizzata, i numeretti cartacei distribuiti da un dispenser, o la gestione "a voce" da parte del personale.
        *   **Pro**: Costo di implementazione nullo o irrisorio.
        *   **Contro**: Totalmente inefficienti, nessuna raccolta dati, esperienza utente pessima, nessuna stima dei tempi di attesa, alto potenziale di conflitto. Rappresentano lo scenario base da migliorare.

    *   **2. Sistemi a Media Tecnologia (Kiosk e Display)**
        *   **Descrizione**: I classici totem "elimina-code" che stampano un biglietto con un numero. Un display centralizzato mostra il numero servito e lo sportello/cassa di riferimento.
        *   **Player di riferimento**: Qmatic, Wavetec (nei loro tier base).
        *   **Pro**: Portano un ordine di base al flusso di clienti, gestiscono la priorità in modo sequenziale.
        *   **Contro**: L'esperienza è statica e impersonale. Il cliente è "legato" al display e non può muoversi liberamente. L'attesa rimane passiva e non c'è interazione né raccolta di dati contestuali.

    *   **3. Sistemi ad Alta Tecnologia (Digitali e Omnicanale)**
        *   **Descrizione**: Soluzioni software (spesso SaaS) che permettono ai clienti di entrare in una coda virtuale tramite app, SMS, QR code o portale web. Forniscono notifiche in tempo reale e dashboard analitiche per i manager.
        *   **Player di riferimento**: Qminder, Waitwhile, Skiplino, NewStore, Mercaux, XY Retail.
        *   **Caratteristiche Comuni**:
            *   **Virtual Check-in**: Ingresso in coda da remoto o in-store senza biglietto fisico.
            *   **Notifiche**: Aggiornamenti via SMS o notifiche push sullo stato della coda.
            *   **Analytics**: Dashboard con dati su tempi di attesa, numero di clienti, performance degli operatori.
            *   **Integrazioni**: Spesso si integrano con CRM e sistemi POS esistenti.
        *   **Limiti Comuni**: Molte soluzioni richiedono al cliente di scaricare un'app dedicata, si concentrano sulla gestione passiva dell'attesa (ti dico quanto aspettare, ma non ti aiuto nell'attesa), o sono parte di suite enterprise complesse e costose (Oracle, Salesforce), difficilmente accessibili per retailer di medie dimensioni.

*   **Fattori di Differenziazione**:
    Sulla base dell'analisi delle soluzioni esistenti, il nostro progetto si distingue per una combinazione unica di funzionalità e filosofia, focalizzandosi non solo sulla "gestione della coda" ma sulla "valorizzazione dell'attesa".

    *   **1. Contesto e Intenzione dall'Origine**:
        *   **A differenza di altri**: I sistemi standard mettono genericamente "in coda".
        *   **Il nostro approccio**: Grazie agli entry-point multipli e contestuali (QR/NFC per area/prodotto), sappiamo *perché* un cliente è in coda fin dal primo secondo. Questo abilita una personalizzazione immediata dell'esperienza, senza che l'utente debba fare nulla.

    *   **2. Da Attesa Passiva a Esperienza Attiva (AI Concierge)**:
        *   **A differenza di altri**: La concorrenza si focalizza sul notificare i tempi di attesa.
        *   **Il nostro approccio**: Il nostro obiettivo primario è rendere l'attesa *produttiva e coinvolgente*. L'assistente virtuale (RAG) trasforma il tempo perso in un'opportunità di engagement, rispondendo a domande, fornendo informazioni e raccogliendo preferenze. È un cambio di paradigma da "queue management" a "customer engagement during wait time".

    *   **3. Handover Intelligente all'Operatore**:
        *   **A differenza di altri**: I sistemi tradizionali notificano all'operatore che "il numero 123 è il prossimo".
        *   **Il nostro approccio**: Forniamo all'operatore un sommario conciso e intelligente del contesto del cliente (da dove è entrato, di cosa ha discusso con l'AI). Questo permette all'operatore di iniziare la conversazione in modo informato ed efficiente, elevando la qualità del servizio e l'esperienza percepita.

    *   **4. Zero Attrito: No App, No Login, No GPS Invasivo**:
        *   **A differenza di altri**: Molte soluzioni digitali richiedono il download di un'app o la creazione di un account, creando una barriera all'adozione per un'interazione spot in negozio.
        *   **Il nostro approccio**: L'accesso è immediato tramite browser web (QR/NFC), con una sessione anonima e persistente. Questo massimizza l'adozione. La logica di "presenza" non si basa su GPS invasivo ma su euristiche "soft", rispettando la privacy.

    *   **5. Architettura Pragmatica e Accessibile**:
        *   **A differenza di altri**: Le grandi suite enterprise sono potenti ma complesse e costose.
        *   **Il nostro approccio**: L'architettura scelta (Postgres come cuore, n8n come orchestratore) è estremamente robusta ma anche pragmatica e accessibile, permettendo un'implementazione più snella e costi di gestione inferiori, adatta anche a singoli punti vendita o catene di medie dimensioni.