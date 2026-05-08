param(
    [string]$BaseUrl = "http://127.0.0.1:8081",
    [string]$TargetDb = "supplier_platform_phase_validation",
    [switch]$RunPhaseCloseoutPrecheck,
    [string]$SummaryOut
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function Start-BackendJob {
    param([string]$AliasEnabled)
    return Start-Job -ScriptBlock {
        param($db, $alias)
        powershell -NoProfile -ExecutionPolicy Bypass -File "d:\Project1\scripts\start-backend-revamp-gate.ps1" -TargetDb $db -AliasEnabled $alias
    } -ArgumentList $TargetDb, $AliasEnabled
}

function Stop-BackendJob {
    param($Job)
    if ($null -eq $Job) { return }
    Stop-Job -Job $Job -ErrorAction SilentlyContinue | Out-Null
    Receive-Job -Job $Job -Keep -ErrorAction SilentlyContinue | Out-Null
    Remove-Job -Job $Job -Force -ErrorAction SilentlyContinue | Out-Null
}

function Wait-ReadySnapshot {
    param([int]$MaxAttempts = 80)
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        try {
            $response = Invoke-RestMethod -Uri "$BaseUrl/api/ops/revamp-cutover-readiness" -Method GET -TimeoutSec 2
            if ($response.success -and $response.data) {
                return $response
            }
        } catch {
        }
        Start-Sleep -Seconds 2
    }
    throw "Runtime readiness endpoint did not become available at $BaseUrl."
}

function Assert-Snapshot {
    param(
        $Snapshot,
        [bool]$ExpectedAliasEnabled,
        [string]$PhaseName
    )

    if ($Snapshot.data.status -ne "READY") {
        throw "$PhaseName failed: status=$($Snapshot.data.status), expected READY."
    }
    if ($Snapshot.data.readyForAliasEnable -ne $true) {
        throw "$PhaseName failed: readyForAliasEnable=$($Snapshot.data.readyForAliasEnable), expected true."
    }
    if ($Snapshot.data.switches.aliasEnabled -ne $ExpectedAliasEnabled) {
        throw "$PhaseName failed: aliasEnabled=$($Snapshot.data.switches.aliasEnabled), expected $ExpectedAliasEnabled."
    }
}

$job = $null
try {
    if ($RunPhaseCloseoutPrecheck) {
        Write-Host "Precheck: phase closeout on PostgreSQL..."
        powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/validate-phase-closeout-postgres.ps1"
    }

    Write-Host "Phase A: start runtime with alias OFF..."
    $job = Start-BackendJob -AliasEnabled "false"
    $precheckSnapshot = Wait-ReadySnapshot
    Assert-Snapshot -Snapshot $precheckSnapshot -ExpectedAliasEnabled $false -PhaseName "Alias OFF precheck"

    Write-Host "Phase B: run strict gate against live runtime..."
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/run-revamp-cutover-gate-postgres.ps1" -SkipPhaseCloseout

    Write-Host "Phase C: switch runtime to alias ON..."
    Stop-BackendJob -Job $job
    $job = Start-BackendJob -AliasEnabled "true"
    $aliasOnSnapshot = Wait-ReadySnapshot
    Assert-Snapshot -Snapshot $aliasOnSnapshot -ExpectedAliasEnabled $true -PhaseName "Alias ON verification"

    Write-Host "Phase D: rollback runtime to alias OFF..."
    Stop-BackendJob -Job $job
    $job = Start-BackendJob -AliasEnabled "false"
    $rollbackSnapshot = Wait-ReadySnapshot
    Assert-Snapshot -Snapshot $rollbackSnapshot -ExpectedAliasEnabled $false -PhaseName "Alias OFF rollback verification"

    $summary = [pscustomobject]@{
        preGateAliasOff = $precheckSnapshot.data.switches.aliasEnabled
        preGateStatus = $precheckSnapshot.data.status
        dryRunAliasOn = $aliasOnSnapshot.data.switches.aliasEnabled
        dryRunStatus = $aliasOnSnapshot.data.status
        rollbackAliasOff = $rollbackSnapshot.data.switches.aliasEnabled
        rollbackStatus = $rollbackSnapshot.data.status
        completedAt = (Get-Date).ToString("s")
    }

    if (-not [string]::IsNullOrWhiteSpace($SummaryOut)) {
        $summary | ConvertTo-Json -Depth 6 | Set-Content -Path $SummaryOut -Encoding UTF8
    }

    $summary | ConvertTo-Json -Depth 6
}
finally {
    Stop-BackendJob -Job $job
}
