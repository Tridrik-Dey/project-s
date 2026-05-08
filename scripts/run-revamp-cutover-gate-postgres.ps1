param(
    [string]$BaseUrl = "http://127.0.0.1:8081",
    [string]$ComposeFile = "docker-compose.yml",
    [string]$ServiceName = "postgres",
    [string]$ContainerName = "supplier_platform_db",
    [string]$DbAdmin = "supplier_admin",
    [string]$DbPassword = "supplier_pass",
    [string]$TargetDb = "supplier_platform_phase_validation",
    [switch]$StrictLegacyParity,
    [switch]$SkipRuntimeApi,
    [switch]$SkipPhaseCloseout
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function Assert-ReadyApi {
    param([string]$Url)

    try {
        $response = Invoke-RestMethod -Uri $Url -Method GET -TimeoutSec 20
    } catch {
        throw "Unable to reach '$Url'. Start backend and ensure it points to '$TargetDb'. Error: $($_.Exception.Message)"
    }

    if (-not $response.success) {
        throw "Cutover readiness API returned success=false."
    }
    if (-not $response.data) {
        throw "Cutover readiness API returned no data payload."
    }
    if ($response.data.status -ne "READY") {
        throw "Cutover readiness API status is '$($response.data.status)' (expected READY)."
    }
    if ($response.data.readyForAliasEnable -ne $true) {
        throw "Cutover readiness API readyForAliasEnable is '$($response.data.readyForAliasEnable)' (expected true)."
    }
}

if ($SkipPhaseCloseout) {
    Write-Host "Step 1/4: phase closeout validation skipped (-SkipPhaseCloseout)."
} else {
    Write-Host "Step 1/4: validating migration phase closeout on PostgreSQL..."
    & "scripts/validate-phase-closeout-postgres.ps1" `
        -ComposeFile $ComposeFile `
        -ServiceName $ServiceName `
        -ContainerName $ContainerName `
        -DbAdmin $DbAdmin `
        -DbPassword $DbPassword `
        -ValidationDb $TargetDb
}

Write-Host "Step 2/4: validating revamp cutover integrity on PostgreSQL..."
if ($StrictLegacyParity) {
    & "scripts/validate-revamp-cutover-readiness-postgres.ps1" `
        -ComposeFile $ComposeFile `
        -ServiceName $ServiceName `
        -ContainerName $ContainerName `
        -DbAdmin $DbAdmin `
        -DbPassword $DbPassword `
        -TargetDb $TargetDb `
        -StrictLegacyParity
} else {
    & "scripts/validate-revamp-cutover-readiness-postgres.ps1" `
        -ComposeFile $ComposeFile `
        -ServiceName $ServiceName `
        -ContainerName $ContainerName `
        -DbAdmin $DbAdmin `
        -DbPassword $DbPassword `
        -TargetDb $TargetDb
}

if ($SkipRuntimeApi) {
    Write-Host "Step 3/4: runtime cutover readiness API check skipped (-SkipRuntimeApi)."
} else {
    Write-Host "Step 3/4: asserting runtime cutover readiness API..."
    $opsUrl = "$BaseUrl/api/ops/revamp-cutover-readiness"
    Assert-ReadyApi -Url $opsUrl
    Write-Host "PASS  runtime_cutover_readiness_api"
}

Write-Host "Step 4/4: running revamp Postgres integration tests..."
Push-Location "backend"
try {
    $mavenCmd = if (Test-Path ".\mvnw.cmd") { ".\mvnw.cmd" } else { "mvn" }
    & $mavenCmd `
        "-Dspring.datasource.url=jdbc:postgresql://localhost:5433/$TargetDb" `
        "-Dspring.datasource.username=$DbAdmin" `
        "-Dspring.datasource.password=$DbPassword" `
        "-Dspring.datasource.driver-class-name=org.postgresql.Driver" `
        "-Dspring.jpa.hibernate.ddl-auto=validate" `
        "-Dspring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect" `
        "-Dflyway.enabled=false" `
        "-Dtest=RevampWorkflowIntegrationTest,RevampReconciliationIntegrationTest" `
        test
    if ($LASTEXITCODE -ne 0) {
        throw "Revamp Postgres integration tests failed."
    }
} finally {
    Pop-Location
}

Write-Host "Cutover gate passed: schema, integrity, runtime readiness, and revamp integration tests are all green."
