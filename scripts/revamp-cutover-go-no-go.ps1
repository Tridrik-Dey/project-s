param(
    [string]$BaseUrl = "http://127.0.0.1:8081",
    [string]$TargetDb = "supplier_platform_phase_validation",
    [string]$OutputRoot = "test-results/revamp-cutover"
)

$ErrorActionPreference = "Stop"

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/run-revamp-cutover-evidence-pack.ps1" `
    -BaseUrl $BaseUrl `
    -TargetDb $TargetDb `
    -OutputRoot $OutputRoot

if ($LASTEXITCODE -ne 0) {
    throw "revamp-cutover-go-no-go failed."
}
