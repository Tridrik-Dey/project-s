param(
    [string]$BaseUrl = "http://127.0.0.1:8081",
    [string]$ContractTests = "RevampApplicationControllerContractTest,RevampInviteControllerContractTest,RevampReviewControllerContractTest,RevampEvaluationControllerContractTest,RevampNotificationControllerContractTest,RevampReportControllerContractTest,RevampSearchControllerContractTest,RevampAuditControllerContractTest,OpsControllerContractTest",
    [string]$SummaryOut
)

$ErrorActionPreference = "Stop"
$blockingReasons = New-Object System.Collections.Generic.List[string]
$checks = New-Object System.Collections.Generic.List[object]

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

function Invoke-ApiCheck {
    param(
        [string]$Name,
        [string]$Url,
        [scriptblock]$AssertBlock
    )
    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 10
        $result = & $AssertBlock $response
        Add-Check -Name $Name -Passed $result.passed -Details $result.details
    } catch {
        Add-Check -Name $Name -Passed $false -Details $_.Exception.Message
    }
}

Write-Host "Smoke 1/3: runtime readiness endpoint..."
Invoke-ApiCheck -Name "runtime_readiness" -Url "$BaseUrl/api/ops/revamp-cutover-readiness" -AssertBlock {
    param($resp)
    if (-not $resp.success) { return @{ passed = $false; details = "success=false" } }
    if (-not $resp.data) { return @{ passed = $false; details = "missing data payload" } }
    if (-not $resp.data.switches) { return @{ passed = $false; details = "missing switches payload" } }
    if (-not ($resp.data.switches.PSObject.Properties.Name -contains "aliasEnabled")) { return @{ passed = $false; details = "missing switches.aliasEnabled" } }
    if (-not ($resp.data.switches.PSObject.Properties.Name -contains "readEnabled")) { return @{ passed = $false; details = "missing switches.readEnabled" } }
    if (-not ($resp.data.switches.PSObject.Properties.Name -contains "writeEnabled")) { return @{ passed = $false; details = "missing switches.writeEnabled" } }
    @{ passed = $true; details = "ops readiness contract OK" }
}

Write-Host "Smoke 2/3: runtime health endpoint..."
Invoke-ApiCheck -Name "runtime_health" -Url "$BaseUrl/api/ops/health" -AssertBlock {
    param($resp)
    if (-not $resp.success) { return @{ passed = $false; details = "success=false" } }
    if (-not $resp.data) { return @{ passed = $false; details = "missing data payload" } }
    if (-not ($resp.data.PSObject.Properties.Name -contains "status")) { return @{ passed = $false; details = "missing data.status" } }
    if (-not ($resp.data.PSObject.Properties.Name -contains "databaseUp")) { return @{ passed = $false; details = "missing data.databaseUp" } }
    @{ passed = $true; details = "ops health contract OK" }
}

Write-Host "Smoke 3/3: revamp critical contract tests..."
Push-Location "backend"
try {
    mvn `
        "-Dmaven.repo.local=d:/Project1/.m2/repository" `
        "-Dtest=$ContractTests" `
        test | Out-Host
    $contractsPassed = ($LASTEXITCODE -eq 0)
    $contractsDetails = if ($contractsPassed) {
        "Contract tests passed ($ContractTests)."
    } else {
        "Contract tests failed ($ContractTests)."
    }
    Add-Check -Name "critical_revamp_contract_suite" -Passed $contractsPassed -Details $contractsDetails
}
finally {
    Pop-Location
}

$allPassed = ($blockingReasons.Count -eq 0)
$summary = [pscustomobject]@{
    status = if ($allPassed) { "PASS" } else { "FAIL" }
    checks = $checks
    blockingReasons = $blockingReasons
    completedAt = (Get-Date).ToString("s")
}

$summaryJson = $summary | ConvertTo-Json -Depth 8
if (-not [string]::IsNullOrWhiteSpace($SummaryOut)) {
    $summaryJson | Set-Content -Path $SummaryOut -Encoding UTF8
}

$summaryJson

if (-not $allPassed) {
    throw "Post-switch smoke checks failed."
}
