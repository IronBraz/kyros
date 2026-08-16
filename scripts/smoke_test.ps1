# scripts/smoke_test.ps1
# Smoke test §6: concurrent queue, heartbeat, and session-recovery checks.
#
# Usage:
#   ./scripts/smoke_test.ps1 -EntryPointSlug main-entrance -AdminPin <pin> -StoreId <uuid>
#   ./scripts/smoke_test.ps1 -BaseUrl https://your-deployment-url ...
#
# Never hardcode a real PIN here. Pass -AdminPin or set $env:KYROS_ADMIN_PIN.
#
# What it tests automatically:
#   §6.1 Concorrenza queue  — 5 parallel sessions + uniqueness + FIFO check
#   §6.2 Ticket uniqueness  — no duplicate ticket_code across parallel creates
#   §6.5 Reset demo          — purges sessions via pre_demo.ps1 -Reset
#
# Manual steps (cannot be automated in a script):
#   §6.2 Heartbeat under load — open 15 tabs + throttle DevTools
#   §6.3 Chat AI parallel     — 5 clients open ChatPanel simultaneously
#   §6.4 Session recovery     — refresh browser mid-wait

param(
    [string]$BaseUrl        = $(if ($env:KYROS_BASE_URL)  { $env:KYROS_BASE_URL }  else { "http://localhost:5173" }),
    [string]$EntryPointSlug = $(if ($env:KYROS_EP_SLUG)   { $env:KYROS_EP_SLUG }   else { "" }),
    [string]$AdminPin       = $(if ($env:KYROS_ADMIN_PIN) { $env:KYROS_ADMIN_PIN } else { "" }),
    [string]$StoreId        = $(if ($env:KYROS_STORE_ID)  { $env:KYROS_STORE_ID }  else { "" }),
    [int]$ParallelSessions  = 5
)

$ErrorActionPreference = "Continue"
$ApiBase = $BaseUrl -replace ":\d+$", ":5678"   # n8n/backend on :5678 if frontend on :5173

Write-Host "`n=== Kyros Smoke Test ===" -ForegroundColor Cyan

# Validate required params
$missing = @()
if (-not $EntryPointSlug) { $missing += "EntryPointSlug" }
if (-not $AdminPin)       { $missing += "AdminPin" }
if (-not $StoreId)        { $missing += "StoreId" }
if ($missing.Count -gt 0) {
    Write-Error "Required parameters missing: $($missing -join ', ')`nUsage: ./smoke_test.ps1 -EntryPointSlug <slug> -AdminPin <pin> -StoreId <uuid>"
    exit 1
}

$Pass = 0
$Fail = 0
function Pass($msg) { Write-Host "  ✓ PASS — $msg" -ForegroundColor Green; $script:Pass++ }
function Fail($msg) { Write-Host "  ✗ FAIL — $msg" -ForegroundColor Red;   $script:Fail++ }
function Info($msg) { Write-Host "  ℹ $msg"         -ForegroundColor DarkGray }

# ------------------------------------------------------------------
# §6.1 + §6.2  Concurrent session creation — uniqueness + FIFO
# ------------------------------------------------------------------
Write-Host "`n[TEST 1] Concurrent session creation ($ParallelSessions parallel)" -ForegroundColor Yellow

$createUrl = "$BaseUrl/api/v1/client/sessions"
$body      = @{ entry_point_id = $EntryPointSlug } | ConvertTo-Json

$jobs = 1..$ParallelSessions | ForEach-Object {
    Start-Job -ScriptBlock {
        param($url, $b)
        try {
            $r = Invoke-RestMethod $url -Method POST -Body $b -ContentType "application/json" -TimeoutSec 10
            return @{ success = $r.success; session_id = $r.data.session_id; ticket_code = $r.data.ticket_code; position = $r.data.position }
        } catch {
            return @{ success = $false; error = $_.ToString() }
        }
    } -ArgumentList $createUrl, $body
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$successful = $results | Where-Object { $_.success -eq $true }
$failed     = $results | Where-Object { $_.success -ne $true }

if ($failed.Count -gt 0) {
    Fail "$($failed.Count) session create(s) returned error"
    $failed | ForEach-Object { Info "  Error: $($_.error)" }
} else {
    Pass "All $ParallelSessions session creates succeeded"
}

# Check uniqueness
$tickets  = $successful | ForEach-Object { $_.ticket_code }
$unique   = $tickets | Sort-Object -Unique
if ($unique.Count -eq $tickets.Count) {
    Pass "All $($tickets.Count) ticket codes are unique: $($tickets -join ', ')"
} else {
    Fail "DUPLICATE ticket codes detected! $($tickets -join ', ')"
}

# Check positions are contiguous (FIFO)
$positions = $successful | ForEach-Object { [int]$_.position } | Sort-Object
$expectedPositions = 1..$ParallelSessions
$posOk = ($positions -join ',') -eq ($expectedPositions -join ',')
if ($posOk) {
    Pass "Positions are contiguous FIFO: $($positions -join ', ')"
} else {
    Info "Positions: $($positions -join ', ') (may overlap with existing queue — check manually)"
}

# Collect session IDs for cleanup
$sessionIds = $successful | ForEach-Object { $_.session_id }

# ------------------------------------------------------------------
# §6.1  Admin call-next race (requires 2 concurrent admin calls)
# ------------------------------------------------------------------
Write-Host "`n[TEST 2] Admin login + concurrent call-next" -ForegroundColor Yellow

# Admin login
try {
    $loginUrl  = "$BaseUrl/api/v1/admin/auth/verify"
    $loginBody = @{ store_id = $StoreId; access_code = $AdminPin } | ConvertTo-Json
    $loginResp = Invoke-RestMethod $loginUrl -Method POST -Body $loginBody -ContentType "application/json" -TimeoutSec 10
    if ($loginResp.success -and $loginResp.data.session_token) {
        $token = $loginResp.data.session_token
        Pass "Admin login succeeded"
    } else {
        Fail "Admin login returned success=false: $($loginResp.error.message)"
        $token = $null
    }
} catch {
    Fail "Admin login request failed: $_"
    $token = $null
}

if ($token -and $successful.Count -ge 2) {
    $callUrl     = "$BaseUrl/api/v1/admin/queue/call-next"
    $callHeaders = @{ "Authorization" = "Bearer $token" }
    $callBody    = @{ store_id = $StoreId } | ConvertTo-Json

    # Two concurrent call-next
    $callJobs = 1..2 | ForEach-Object {
        Start-Job -ScriptBlock {
            param($url, $h, $b)
            try {
                $r = Invoke-RestMethod $url -Method POST -Headers $h -Body $b -ContentType "application/json" -TimeoutSec 10
                return @{ success = $r.success; ticket = $r.data.ticket_code; sp = $r.data.service_point_name }
            } catch {
                return @{ success = $false; error = $_.ToString() }
            }
        } -ArgumentList $callUrl, $callHeaders, $callBody
    }
    $callResults = $callJobs | Wait-Job | Receive-Job
    $callJobs | Remove-Job

    $calledTickets = $callResults | Where-Object { $_.success } | ForEach-Object { $_.ticket }
    $uniqueCalled  = $calledTickets | Sort-Object -Unique

    if ($uniqueCalled.Count -eq $calledTickets.Count -and $calledTickets.Count -gt 0) {
        Pass "Two concurrent call-next returned distinct tickets: $($calledTickets -join ', ')"
    } elseif ($calledTickets.Count -eq 0) {
        Fail "Both concurrent call-next failed (queue may be empty or auth issue)"
    } else {
        Fail "Concurrent call-next returned SAME ticket! FOR UPDATE SKIP LOCKED may not be working."
    }
} else {
    Info "Skipping concurrent call-next (admin token unavailable or <2 sessions created)"
}

# ------------------------------------------------------------------
# §6.4  Session recovery — check GET /sessions/:id returns correct state
# ------------------------------------------------------------------
Write-Host "`n[TEST 3] Session recovery check" -ForegroundColor Yellow

if ($sessionIds.Count -gt 0) {
    $testId = $sessionIds[0]
    try {
        $recoverResp = Invoke-RestMethod "$BaseUrl/api/v1/client/sessions/$testId" -Method GET -TimeoutSec 10
        if ($recoverResp.success -and $recoverResp.data.status) {
            Pass "Session recovery: GET /sessions/$testId → status='$($recoverResp.data.status)'"
        } else {
            Fail "Session recovery returned success=false"
        }
    } catch {
        Fail "Session recovery request failed: $_"
    }
} else {
    Info "No sessions to test recovery (session creation failed above)"
}

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------
Write-Host "`n=== Smoke Test Summary ===" -ForegroundColor Cyan
Write-Host "  PASS: $Pass   FAIL: $Fail" -ForegroundColor $(if ($Fail -gt 0) { "Red" } else { "Green" })

Write-Host @"

--- Manual checks still needed ---
§6.2  Open 15 tabs on /waiting, throttle 5 to Slow 3G in DevTools.
      Expected: all remain 'waiting' for 30 min without going 'abandoned'.
§6.3  5 clients open ChatPanel simultaneously, send 3 messages each.
      Expected: DB query 'SELECT * FROM ai_messages' shows correct conversation_id isolation.
§6.4  Browser refresh during waiting/called/serving.
      Expected: state restored from localStorage, no crash, no unexpected redirect.

--- Run reset when done ---
  ./scripts/pre_demo.ps1 -Reset
"@ -ForegroundColor DarkGray

if ($Fail -gt 0) { exit 1 } else { exit 0 }
