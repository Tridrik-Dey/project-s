param(
    [string]$TargetDb = "supplier_platform_phase_validation",
    [string]$AliasEnabled = "false"
)

$ErrorActionPreference = "Stop"

$env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5433/$TargetDb"
$env:SPRING_DATASOURCE_USERNAME = "supplier_admin"
$env:SPRING_DATASOURCE_PASSWORD = "supplier_pass"
$env:SPRING_DATASOURCE_DRIVER_CLASS_NAME = "org.postgresql.Driver"
$env:SPRING_JPA_HIBERNATE_DDL_AUTO = "validate"
$env:SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT = "org.hibernate.dialect.PostgreSQLDialect"
$env:FEATURE_REVAMP_READ_ENABLED = "true"
$env:FEATURE_REVAMP_WRITE_ENABLED = "true"
$aliasNormalized = $AliasEnabled.Trim().ToLowerInvariant()
$aliasOn = $aliasNormalized -in @("true", "1", "$true")
$env:FEATURE_REVAMP_ALIAS_ENABLED = if ($aliasOn) { "true" } else { "false" }

Set-Location "d:\Project1\backend"
mvn "-Dmaven.repo.local=d:/Project1/.m2/repository" spring-boot:run
