# Kyros - Deployment & Operations (Fase 1)

**Ambito:** Hosting, Gestione Server, Aggiornamenti e Disaster Recovery.
**Riferimenti:** Operatività su hardware proprietario (Local PC) esposto via Cloudflare.

---

## 1. Architettura di Deployment (Fase 1 - MVP)
Per le fasi MVP e Pilot, Kyros risiede come "Tenant" all'interno dell'infrastruttura **NeuroForge** esistente.

*   **Host**: PC Locale (your dev machine) - Cartella `Documenti-Analisi/NeuroForge`.
*   **Orchestrator**: Docker Compose (Stack NeuroForge v1.0).
*   **Database**: Istanza `postgres` (18.1) condivisa. Database dedicato `kyros_db`.
*   **Backend Logic**: Istanza `n8n` condivisa (prefisso workflow `QUE_`).
*   **Networking**:
    *   Interno: Rete Docker `synaptic`.
    *   Esterno: **Cloudflare Tunnel** (gestito da NeuroForge) -> Caddy -> PWA/n8n.
    *   Domini: `your-domain.example.com` (PWA), `n8n.your-domain.example.com` (n8n API).

**Script di Gestione dedicati:**
*   `scripts/manage_kyros_db.ps1`: Script PowerShell per creare/resettare il DB `kyros_db` e applicare lo schema.
*   `scripts/kyros_schema.sql`: DDL SQL aggiornato per la creazione tabelle.

---

## 2. Gestione Operativa (Day-to-Day)

### A. Avvio e Stop
Gestione manuale tramite CLI Docker Compose.
*   **Avvio**: `docker-compose up -d`
*   **Stop**: `docker-compose down`
*   **Logs**: `docker-compose logs -f` (per debug immediato).

### B. Aggiornamento Software
Procedura manuale controllata (per evitare rotture inattese durante l'operatività).
1.  Scaricare l'ultima versione del codice: `git pull`
2.  Ricostruire/Scaricare immagini: `docker-compose build` (o `pull`)
3.  Riavviare i servizi: `docker-compose up -d`

---

## 3. Strategia di Backup (MVP)
Protezione essenziale dei dati contro guasti hardware.

*   **Database (PostgreSQL)**:
    *   Script giornaliero (schedulato via Task Scheduler/Cron) che esegue `pg_dump`.
    *   Destinazione: Cartella locale sincronizzata su Cloud (es. `C:\\Users\\<your-username>\\OneDrive\Backups\Kyros`).
*   **Configurazioni (n8n)**:
    *   Export manuale dei workflow JSON prima di modifiche importanti.
    *   La cartella dei dati Docker di n8n è inclusa nel backup system del PC.

---

## 4. Disaster Recovery (MVP)
Cosa fare se il PC "esplode":
1.  Recuperare PC secondario (muletto).
2.  Installare Docker Desktop e Git.
3.  Clonare repo e scaricare backup DB da OneDrive.
4.  Avviare `docker-compose up`.
5.  Riconfigurare Cloudflare Tunnel (login auth).
6.  Restore del DB: `cat backup.sql | docker exec -i kyros-postgres psql -U user -d kyros`.

---

## 5. Evoluzione Operations (Spostato a FASE 3 - Scale-Up)
Le seguenti pratiche avanzate sono **escluse dall'MVP** e verranno implementate solo quando il progetto scalerà su infrastruttura Cloud dedicata o multi-tenant critico.

*   **Automazione Deploy**:
    *   *Watchtower*: Aggiornamento automatico dei container all'uscita di nuove immagini.
    *   *CI/CD Pipelines*: Test automatici su GitHub Actions prima del deploy.
*   **Infrastruttura**:
    *   Migrazione su VPS Enterprise (AWS/Hetzner) per SLA garantiti.
    *   Kubernetes (K8s) se i nodi diventano > 3.
*   **Monitoring Avanzato**:
    *   Stack Prometheus + Grafana per metriche in tempo reale.
    *   Alerting via SMS/Chiamata (PagerDuty) per downtime notturni.
*   **High Availability**:
    *   Database replicato (Master-Slave).
    *   Load Balancer tra più istanze server.

---

## 6. Quick Start & Access Credentials (MVP Integration)

Questa sezione guida l'avvio del progetto all'interno dell'ecosistema NeuroForge.

### A. Procedura di Avvio (Day 1)
1.  **Avviare NeuroForge**:
    Assicurarsi che lo stack principale sia attivo.
    ```powershell
    cd Documenti-Analisi/NeuroForge
    docker compose up -d
    ```
2.  **Inizializzare Kyros DB**:
    Eseguire lo script di gestione che si collega al container condiviso.
    ```powershell
    # Dalla root del progetto Kyros
    .\OUTPUT\postgres\manage_kyros_db.ps1
    ```
    *Seguire le istruzioni a video per creare il database e le tabelle.*

3.  **Configurare n8n**:
    *   Accedere a `https://n8n.your-domain.example.com` (o `http://localhost:5678`).
    *   Creare una **Postgres Credential**:
        *   **Host**: `postgres`
        *   **User**: (Vedi variabile `POSTGRES_USER` nel file `.env` di NeuroForge)
        *   **Password**: (Vedi variabile `POSTGRES_PASSWORD` nel file `.env` di NeuroForge)
        *   **Database**: `kyros_db`
    *   Testare la connessione.

4.  **Creare Codice Accesso Admin**:
    Dopo aver creato il primo Store tramite wizard, inserire il codice di accesso:
    ```sql
    -- Sostituisci con l'UUID del tuo store
    INSERT INTO admin_access (store_id, access_code, label)
    VALUES (
      'uuid-del-tuo-store',
      '1234',  -- CAMBIA QUESTO!
      'Admin'
    );
    ```
    
    **IMPORTANTE**: Cambia il codice `1234` con uno personalizzato prima di andare live.

### B. Credenziali e Riferimenti
| Servizio | URL / Endpoint | User | Password | Note |
| :--- | :--- | :--- | :--- | :--- |
| **n8n** | `https://n8n.your-domain.example.com` | `admin` | *(Vedi .env)* | Workflow Engine (Backend Logic) |
| **Kyros Client** | `https://your-domain.example.com/` | N/A | N/A | Interfaccia Pubblica |
| **Kyros Admin** | `https://your-domain.example.com/control-room` | N/A | N/A | Dashboard Gestore |
| **Postgres** | `postgres:5432` | `n8n_user` | *(Vedi .env)* | Accesso interno Docker |
| **PGAdmin** | `http://localhost:5050` | `admin@neuroforge.local` | *(Vedi .env)* | Gestione DB GUI |

> **Nota:** Per disinstallare il DB di Kyros, rilanciare lo script `manage_kyros_db.ps1` e selezionare l'opzione "DISINSTALLA" o usare PGAdmin (Tasto destro sul DB -> Delete/Drop).