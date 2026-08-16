# scripts/dev-api.ps1
# Starts the backend for local development.
#
# Why this exists instead of just `vercel dev`:
#   1. `vercel dev` does not reliably inject the marketplace-managed environment variables
#      (DATABASE_URL and friends come from the Neon integration as encrypted references)
#      into the serverless function. It loads .env.local for the dev command but the
#      function starts without them. Exporting them into the shell first works, because the
#      function process inherits the parent environment.
#   2. Vercel defaults to port 3000, which on this machine is Grafana from the NeuroForge
#      Docker stack. 3001 is taken too.
#
# In production none of this applies: Vercel injects the variables at runtime.
#
# Usage:
#   ./scripts/dev-api.ps1              # port 3100
#   ./scripts/dev-api.ps1 -Port 3200

param(
    [int]$Port = 3100
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $Root ".env.local"

if (-not (Test-Path $EnvFile)) {
    Write-Error ".env.local not found. Run `vercel env pull` or `vercel integration add neon` first."
}

$loaded = 0
foreach ($line in Get-Content $EnvFile) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) { continue }

    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }

    $name  = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1).Trim()

    # Vercel writes values wrapped in double quotes; strip one matching pair.
    if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
    $loaded++
}

Write-Host "Loaded $loaded variables from .env.local" -ForegroundColor Green

# CRON_SECRET is only injected by Vercel in the cloud. Without it /api/internal/* refuses
# every request, which makes the cron impossible to exercise locally.
if (-not $env:CRON_SECRET) {
    $env:CRON_SECRET = "local-dev-cron-secret"
    Write-Host "CRON_SECRET not set, using 'local-dev-cron-secret' for this session" -ForegroundColor Yellow
}

Write-Host "Starting vercel dev on http://localhost:$Port" -ForegroundColor Cyan
Write-Host "Frontend: run 'npm run dev' in another terminal (Vite on 5173 proxies /api here)`n"

vercel dev --listen $Port
