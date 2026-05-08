param(
    [string]$BaseUrl = "http://127.0.0.1:8081",
    [string]$TargetDb = "supplier_platform_phase_validation",
    [string]$OutputRoot = "test-results/revamp-cutover"
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $OutputRoot $timestamp
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$checks = New-Object System.Collections.Generic.List[object]
$blockingReasons = New-Object System.Collections.Generic.List[string]

function Add-Check {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Details
    )
    $checks.Add([pscustomobject]@{
        name = $Name
        passed = $Passed
        details = $Details
    }) | Out-Null
    if (-not $Passed) { $blockingReasons.Add("${Name}: $Details") | Out-Null }
}

function Invoke-LoggedScriptStep {
    param(
        [string]$Name,
        [string]$ScriptPath,
        [string[]]$Arguments,
        [string]$LogPath
    )
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1 | Tee-Object -FilePath $LogPath | Out-Host
    $ErrorActionPreference = $previousPreference
    $passed = ($LASTEXITCODE -eq 0)
    Add-Check -Name $Name -Passed $passed -Details $(if ($passed) { "PASS" } else { "FAILED; see $LogPath" })
    return $passed
}

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
            $resp = Invoke-RestMethod -Uri "$BaseUrl/api/ops/revamp-cutover-readiness" -Method GET -TimeoutSec 2
            if ($resp.success -and $resp.data) { return $resp }
        } catch {
        }
        Start-Sleep -Seconds 2
    }
    throw "Runtime readiness endpoint did not become available at $BaseUrl."
}

$backendJob = $null
try {
    $phaseCloseoutLog = Join-Path $outputDir "01_phase_closeout.log"
    [void](Invoke-LoggedScriptStep `
            -Name "phase_closeout_postgres" `
            -ScriptPath "scripts/validate-phase-closeout-postgres.ps1" `
            -Arguments @() `
            -LogPath $phaseCloseoutLog)

    $switchLog = Join-Path $outputDir "02_runtime_switch.log"
    $switchSummaryPath = Join-Path $outputDir "02_runtime_switch_summary.json"
    [void](Invoke-LoggedScriptStep `
            -Name "runtime_switch_and_strict_gate" `
            -ScriptPath "scripts/invoke-revamp-runtime-switch.ps1" `
            -Arguments @("-BaseUrl", $BaseUrl, "-TargetDb", $TargetDb, "-SummaryOut", $switchSummaryPath) `
            -LogPath $switchLog)

    $backendJob = Start-BackendJob -AliasEnabled "false"
    $preSmokeSnapshot = Wait-ReadySnapshot
    ($preSmokeSnapshot | ConvertTo-Json -Depth 8) | Set-Content -Path (Join-Path $outputDir "03_pre_smoke_readiness.json") -Encoding UTF8
    Add-Check -Name "pre_smoke_runtime_ready" -Passed $true -Details "Runtime reachable before smoke checks."

    $smokeLog = Join-Path $outputDir "04_post_switch_smoke.log"
    $smokeSummaryPath = Join-Path $outputDir "04_post_switch_smoke_summary.json"
    [void](Invoke-LoggedScriptStep `
            -Name "post_switch_smoke" `
            -ScriptPath "scripts/run-revamp-post-switch-smoke.ps1" `
            -Arguments @("-BaseUrl", $BaseUrl, "-SummaryOut", $smokeSummaryPath) `
            -LogPath $smokeLog)

    $postSmokeSnapshot = Wait-ReadySnapshot
    ($postSmokeSnapshot | ConvertTo-Json -Depth 8) | Set-Content -Path (Join-Path $outputDir "05_post_smoke_readiness.json") -Encoding UTF8
    Add-Check -Name "post_smoke_runtime_ready" -Passed $true -Details "Runtime reachable after smoke checks."
}
catch {
    Add-Check -Name "orchestrator_runtime" -Passed $false -Details $_.Exception.Message
}
finally {
    Stop-BackendJob -Job $backendJob
}

$status = if ($blockingReasons.Count -eq 0) { "PASS" } else { "FAIL" }
$summary = [pscustomobject]@{
    status = $status
    outputDir = (Resolve-Path $outputDir).Path
    checks = $checks
    blockingReasons = $blockingReasons
    completedAt = (Get-Date).ToString("s")
}

$summaryJson = $summary | ConvertTo-Json -Depth 10
$summaryPath = Join-Path $outputDir "00_summary.json"
$summaryJson | Set-Content -Path $summaryPath -Encoding UTF8

$summaryText = @(
    "REVAMP CUTOVER GO/NO-GO: $status"
    "Artifacts: $((Resolve-Path $outputDir).Path)"
    ""
    "Checks:"
) + ($checks | ForEach-Object { "- $($_.name): $($_.passed) ($($_.details))" }) + @(
    ""
    "Blocking reasons:"
) + ($(if ($blockingReasons.Count -eq 0) { @("- none") } else { $blockingReasons | ForEach-Object { "- $_" } }))

$summaryTextPath = Join-Path $outputDir "00_summary.txt"
$summaryText | Set-Content -Path $summaryTextPath -Encoding UTF8

Write-Host "REVAMP CUTOVER GO/NO-GO: $status"
if ($blockingReasons.Count -gt 0) {
    $blockingReasons | ForEach-Object { Write-Host "BLOCKER  $_" }
}
Write-Host "Artifacts: $((Resolve-Path $outputDir).Path)"

if ($status -ne "PASS") {
    throw "Go/No-Go result is FAIL."
}
