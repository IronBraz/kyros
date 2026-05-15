<#
.SYNOPSIS
    Gestore del Database Kyros (Wrapper per Docker Compose di NeuroForge).
    
.DESCRIPTION
    Questo script interagisce con lo stack NeuroForge per gestire il DB di Kyros.
    Funzionalità:
    1. Check stato DB.
    2. Creazione DB (se mancante).
    3. Reset DB (Drop & Re-create).
    4. Disinstallazione (Drop DB).
    5. Applicazione Schema SQL.

.NOTES
    Posizione file: OUTPUT/postgres/manage_kyros_db.ps1
    Dipendenza: Deve puntare al docker-compose.yml in Documenti-Analisi/NeuroForge
#>

# --- Carica .env dalla root del repo (single source of truth) ---
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
}

$DbName = "kyros_db"
$DbUser = "n8n_user"           # Utente applicativo (che userà n8n)
$SuperUser = if ($env:KYROS_PG_ADMIN_USER) { $env:KYROS_PG_ADMIN_USER } else { "postgres" }
$SchemaFile = "$PSScriptRoot\kyros_schema.sql"

# --- RICERCA INTELLIGENTE DOCKER-COMPOSE.YML ---
# Cerca il file di configurazione in vari percorsi per garantire portabilità
# (Funziona sia in Sviluppo che in Produzione C:\NeuroForge)
$PossiblePaths = @(
    "$PSScriptRoot\..\docker-compose.yml",                    # Caso: Script in /scripts
    "$PSScriptRoot\docker-compose.yml",                       # Caso: Script nella root
    "C:\NeuroForge\docker-compose.yml",                       # Caso: Produzione standard
    "$PSScriptRoot\..\..\Documenti-Analisi\NeuroForge\docker-compose.yml" # Caso: Sviluppo locale (custom path)
)

$ComposeFile = $null
foreach ($path in $PossiblePaths) {
    if (Test-Path $path) {
        $ComposeFile = Resolve-Path $path
        Write-Host "Trovato stack NeuroForge in: $ComposeFile" -ForegroundColor DarkGray
        break
    }
}

if (-not $ComposeFile) {
    Write-Host "ERRORE CRITICO: Non trovo 'docker-compose.yml'!" -ForegroundColor Red
    Write-Host "Ho cercato in questi percorsi:"
    $PossiblePaths | ForEach-Object { Write-Host " - $_" -ForegroundColor Gray }
    exit
}

# Funzione helper per eseguire comandi SQL
function Invoke-PostgresCommand {
    param (
        [string]$Sql,
        [string]$Database = "postgres",
        [string]$User = $script:SuperUser
    )
    # Esegue psql nel container. -T disabilita TTY per output pulito.
    docker compose -f $ComposeFile exec -T postgres psql -U $User -d $Database -c "$Sql"
}

# --- MENU ---
Clear-Host
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "      KYROS DATABASE MANAGER (v2.4)       " -ForegroundColor Cyan
Write-Host "      Target Stack: NeuroForge            " -ForegroundColor DarkCyan
Write-Host "      Admin User: $SuperUser              " -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica Servizio
docker compose -f $ComposeFile ps --services --filter "status=running" | Select-String "postgres" > $null
if (-not $?) {
    Write-Host "ERRORE: Il servizio 'postgres' non e' attivo." -ForegroundColor Red
    Write-Host "Avvia NeuroForge prima di procedere."
    exit
}

# 2. Check & Create User (n8n_user)
Write-Host "Verifica utente applicativo '$DbUser'..." -NoNewline
$CheckUserSql = "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'"
$UserExists = docker compose -f $ComposeFile exec -T postgres psql -U $SuperUser -d postgres -tAc $CheckUserSql
$UserExists = $UserExists.Trim()

if ($UserExists -eq '1') {
    Write-Host " OK (Esiste)" -ForegroundColor Green
} else {
    Write-Host " MANCANTE" -ForegroundColor Yellow
    Write-Host "Creazione utente '$DbUser'..." -ForegroundColor Gray
    # Crea utente con password (modificare 'password' se necessario per prod)
    Invoke-PostgresCommand -Sql "CREATE USER $DbUser WITH PASSWORD 'password'; ALTER USER $DbUser CREATEDB;" -User $SuperUser
    Write-Host "Utente creato." -ForegroundColor Green
}

# 3. Check Esistenza DB
$CheckDbParams = "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
$DbExists = docker compose -f $ComposeFile exec -T postgres psql -U $SuperUser -d postgres -tAc $CheckDbParams
$DbExists = $DbExists.Trim()

if ($DbExists -eq '1') {
    Write-Host "STATO: Il database '$DbName' ESISTE." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Scegli un'azione:"
    Write-Host "1. Aggiorna Schema (Applica solo le modifiche/tabelle mancanti)"
    Write-Host "2. RESET TOTALE (Cancella tutti i dati e ricrea)"
    Write-Host "3. DISINSTALLA (Elimina il database e esci)"
    Write-Host "Q. Esci"
    
    $Choice = Read-Host "Scelta"
    
    switch ($Choice) {
        "1" { 
            Write-Host "Applicazione schema..." 
            # Usa $SuperUser per applicare lo schema (permessi extension)
            Get-Content $SchemaFile | docker compose -f $ComposeFile exec -T postgres psql -U $SuperUser -d $DbName
            
            # Assicura permessi al proprietario applicativo
            Invoke-PostgresCommand -Sql "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser; GRANT ALL ON SCHEMA public TO $DbUser;" -User $SuperUser
        }
        "2" {
            Write-Host "Sei SICURO di voler cancellare TUTTI i dati di Kyros? (SI/NO)" -ForegroundColor Red
            $Confirm = Read-Host
            if ($Confirm -eq "SI") {
                 # Kill connections
                Invoke-PostgresCommand -Sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName'" -User $SuperUser
                Invoke-PostgresCommand -Sql "DROP DATABASE $DbName" -User $SuperUser
                Invoke-PostgresCommand -Sql "CREATE DATABASE $DbName OWNER $DbUser" -User $SuperUser
                
                # Applica schema come SuperUser
                Get-Content $SchemaFile | docker compose -f $ComposeFile exec -T postgres psql -U $SuperUser -d $DbName
                
                # Grant finali
                Invoke-PostgresCommand -Sql "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser; GRANT ALL ON SCHEMA public TO $DbUser;" -User $SuperUser

                Write-Host "Database resettato con successo." -ForegroundColor Green
            }
        }
        "3" {
            Write-Host "Rimozione database '$DbName'..." -ForegroundColor Yellow
            Invoke-PostgresCommand -Sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName'" -User $SuperUser
            Invoke-PostgresCommand -Sql "DROP DATABASE $DbName" -User $SuperUser
            Write-Host "Database eliminato. Arrivederci!" -ForegroundColor Green
            exit
        }
        Default { exit }
    }
} else {
    Write-Host "STATO: Il database '$DbName' NON ESISTE." -ForegroundColor Gray
    Write-Host ""
    $Create = Read-Host "Vuoi creare il database ora? (S/N)"
    if ($Create -eq 'S') {
        Write-Host "Creazione database..." -ForegroundColor Green
        Invoke-PostgresCommand -Sql "CREATE DATABASE $DbName OWNER $DbUser" -User $SuperUser
        
        Write-Host "Applicazione schema..."
        Get-Content $SchemaFile | docker compose -f $ComposeFile exec -T postgres psql -U $SuperUser -d $DbName
        
        # Grant finali
        Invoke-PostgresCommand -Sql "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser; GRANT ALL ON SCHEMA public TO $DbUser;" -User $SuperUser
        
        Write-Host "Fatto! Kyros e' pronto." -ForegroundColor Green
    }
}