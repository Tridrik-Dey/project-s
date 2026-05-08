param(
    [string]$ComposeFile = "docker-compose.yml",
    [string]$ServiceName = "postgres",
    [string]$ContainerName = "supplier_platform_db",
    [string]$DbAdmin = "supplier_admin",
    [string]$DbPassword = "supplier_pass",
    [string]$ValidationDb = "supplier_platform_phase_validation"
)

$ErrorActionPreference = "Continue"
$PSNativeCommandUseErrorActionPreference = $false
$dockerConfigPath = "d:\Project1\.docker"
if (-not (Test-Path $dockerConfigPath)) {
    New-Item -ItemType Directory -Path $dockerConfigPath -Force | Out-Null
}
$env:DOCKER_CONFIG = $dockerConfigPath

function Invoke-InContainerPsql {
    param(
        [string]$Database,
        [string]$Sql
    )
    $escaped = $Sql.Replace('"', '\"')
    docker exec -e PGPASSWORD=$DbPassword $ContainerName psql -U $DbAdmin -d $Database -v ON_ERROR_STOP=1 -c $escaped | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "psql command failed against database '$Database'."
    }
}

function Assert-TableExists {
    param([string]$Database, [string]$TableName)
    $sql = 'DO $$ BEGIN IF to_regclass(''' + "public.$TableName" + ''') IS NULL THEN RAISE EXCEPTION ''Missing table: ' + $TableName + '''; END IF; END $$;'
    Invoke-InContainerPsql -Database $Database -Sql $sql
}

function Assert-ViewExists {
    param([string]$Database, [string]$ViewName)
    $sql = 'DO $$ BEGIN IF to_regclass(''' + "public.$ViewName" + ''') IS NULL THEN RAISE EXCEPTION ''Missing view: ' + $ViewName + '''; END IF; IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = ''public'' AND c.relname = ''' + $ViewName + ''' AND c.relkind = ''v'') THEN RAISE EXCEPTION ''Object is not a view: ' + $ViewName + '''; END IF; END $$;'
    Invoke-InContainerPsql -Database $Database -Sql $sql
}

Write-Host "Starting PostgreSQL container..."
docker compose -f $ComposeFile up -d $ServiceName 2>&1 | Out-Host

Write-Host "Waiting for PostgreSQL readiness..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $probe = docker exec -e PGPASSWORD=$DbPassword $ContainerName pg_isready -U $DbAdmin -d postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    throw "PostgreSQL is not ready."
}

Write-Host "Recreating validation database '$ValidationDb'..."
Invoke-InContainerPsql -Database "postgres" -Sql "DROP DATABASE IF EXISTS $ValidationDb;"
Invoke-InContainerPsql -Database "postgres" -Sql "CREATE DATABASE $ValidationDb;"

Write-Host "Applying migrations V1..V12 to '$ValidationDb'..."
$migrations = Get-ChildItem "database/migrations/V*.sql" |
    Sort-Object @{ Expression = {
        $name = $_.BaseName
        if ($name -match '^V(\d+)__') { [int]$matches[1] } else { 999999 }
    }}, Name
foreach ($migration in $migrations) {
    Write-Host "Applying $($migration.Name)..."
    Get-Content $migration.FullName | docker exec -i -e PGPASSWORD=$DbPassword $ContainerName psql -U $DbAdmin -d $ValidationDb -v ON_ERROR_STOP=1 -f - | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed: $($migration.Name)"
    }
}

Write-Host "Validating final physical tables..."
$finalTables = @(
    "applications",
    "application_sections",
    "invites",
    "otp_challenges",
    "review_cases",
    "integration_requests",
    "supplier_registry_profiles",
    "evaluations",
    "evaluation_dimensions",
    "notification_events",
    "audit_events",
    "user_admin_roles"
)

foreach ($t in $finalTables) {
    Assert-TableExists -Database $ValidationDb -TableName $t
}

Write-Host "Validating revamp compatibility views..."
$revampViews = @(
    "revamp_applications",
    "revamp_application_sections",
    "revamp_invites",
    "revamp_otp_challenges",
    "revamp_review_cases",
    "revamp_integration_requests",
    "revamp_supplier_registry_profiles",
    "revamp_evaluations",
    "revamp_evaluation_dimensions",
    "revamp_notification_events",
    "revamp_audit_events",
    "revamp_user_admin_roles"
)

foreach ($v in $revampViews) {
    Assert-ViewExists -Database $ValidationDb -ViewName $v
}

Write-Host "Phase close-out PostgreSQL migration validation completed successfully."
