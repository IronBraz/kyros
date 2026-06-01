# scripts/pre_demo.ps1
# Pre-demo snapshot: backup DB and n8n workflows. Optional --Reset to wipe transient data.
#
# Usage:
#   ./scripts/pre_demo.ps1                    # snapshot only
#   ./scripts/pre_demo.ps1 -Reset             # snapshot + clear sessions/AI data
#   ./scripts/pre_demo.ps1 -DbName mydb ...  # override defaults
#
# Requirements:
#   - pg_dump and psql on PATH (PostgreSQL client tools)
#   - N8N_API_KEY env var OR pass -N8nApiKey (optional — skip n8n export if missing)

param(
    [switch]$Reset,
    [string]$DbName    = $(if ($env:KYROS_DB_NAME)    { $env:KYROS_DB_NAME }    else { "kyros_db" }),
    [string]$DbUser    = $(if ($env:KYROS_DB_USER)    { $env:KYROS_DB_USER }    else { "kyros" }),
    [string]$DbHost    = $(if ($env:KYROS_DB_HOST)    { $env:KYROS_DB_HOST }    else { "localhost" }),
    [string]$DbPort    = $(if ($env:KYROS_DB_PORT)    { $env:KYROS_DB_PORT }    else { "5432" }),
    [string]$N8nUrl    = $(if ($env:N8N_URL)          { $env:N8N_URL }          else { "http://localhost:5678" }),
    [string]$N8nApiKey = $(if ($env:N8N_API_KEY)      { $env:N8N_API_KEY }      else { "" })
)

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$Root      = Split-Path $PSScriptRoot -Parent
$BackupDir = Join-Path $Root "backups"
$N8nBackup = Join-Path $Root "n8n\backup"

# ------------------------------------------------------------------
# 0. Ensure backup directories exist
# ------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path $N8nBackup | Out-Null

Write-Host "`n=== Kyros Pre-Demo Script ($Timestamp) ===" -ForegroundColor Cyan

# ------------------------------------------------------------------
# 1. Database backup
# ------------------------------------------------------------------
Write-Host "`n[1/3] Backing up database '$DbName'..." -ForegroundColor Yellow

$DumpFile = Join-Path $BackupDir "pre_demo_$Timestamp.sql"

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Warning "pg_dump not found on PATH — skipping DB backup."
} else {
    $env:PGPASSWORD = $env:KYROS_DB_PASSWORD
    & pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $DumpFile
    if ($LASTEXITCODE -eq 0) {
        $sizeMb = [math]::Round((Get-Item $DumpFile).Length / 1MB, 2)
        Write-Host "  ✓ Saved: $DumpFile ($sizeMb MB)" -ForegroundColor Green
    } else {
        Write-Error "pg_dump failed (exit $LASTEXITCODE)"
    }
}

# ------------------------------------------------------------------
# 2. n8n workflow export
# ------------------------------------------------------------------
Write-Host "`n[2/3] Exporting n8n workflows..." -ForegroundColor Yellow

if (-not $N8nApiKey) {
    Write-Warning "N8N_API_KEY not set — skipping n8n export. Set env var or pass -N8nApiKey."
} else {
    try {
        $headers  = @{ "X-N8N-API-KEY" = $N8nApiKey; "Accept" = "application/json" }
        $response = Invoke-RestMethod "$N8nUrl/api/v1/workflows?limit=100" -Headers $headers -Method GET
        $workflows = $response.data
        Write-Host "  Found $($workflows.Count) workflow(s)."

        foreach ($wf in $workflows) {
            $safeName = ($wf.name -replace '[^\w\-]', '_').TrimEnd('_')
            $outFile  = Join-Path $N8nBackup "$($wf.id)_$safeName.json"
            $wf | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $outFile
        }
        Write-Host "  ✓ Saved $($workflows.Count) workflow(s) to $N8nBackup" -ForegroundColor Green
    } catch {
        Write-Warning "n8n export failed: $_"
    }
}

# ------------------------------------------------------------------
# 3. Optional reset: wipe transient demo data
# ------------------------------------------------------------------
if ($Reset) {
    Write-Host "`n[3/3] Resetting demo data..." -ForegroundColor Yellow

    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if (-not $psql) {
        Write-Warning "psql not found on PATH — skipping reset."
    } else {
        $resetSql = @"
-- Wipe transient data while preserving tenant config
TRUNCATE ai_messages    CASCADE;
TRUNCATE ai_summaries   CASCADE;
TRUNCATE ai_conversations CASCADE;
TRUNCATE ai_usage_monthly;
TRUNCATE sessions       CASCADE;
-- Re-seed current month budget row
INSERT INTO ai_usage_monthly (year_month)
VALUES (TO_CHAR(NOW(), 'YYYY-MM'))
ON CONFLICT (year_month) DO NOTHING;
SELECT 'Reset complete: sessions=' || COUNT(*) FROM sessions;
"@
        $env:PGPASSWORD = $env:KYROS_DB_PASSWORD
        $resetSql | & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Demo data cleared." -ForegroundColor Green
        } else {
            Write-Error "psql reset failed (exit $LASTEXITCODE)"
        }
    }
} else {
    Write-Host "`n[3/3] Skipping reset (pass -Reset to wipe sessions/AI data)." -ForegroundColor DarkGray
}

Write-Host "`n=== Done. Ready for demo! ===`n" -ForegroundColor Cyan
