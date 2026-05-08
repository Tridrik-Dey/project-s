param(
    [string]$ComposeFile = "docker-compose.yml",
    [string]$ServiceName = "postgres",
    [string]$ContainerName = "supplier_platform_db",
    [string]$DbAdmin = "supplier_admin",
    [string]$DbPassword = "supplier_pass",
    [string]$TargetDb = "supplier_platform_phase_validation",
    [switch]$StrictLegacyParity
)

$ErrorActionPreference = "Continue"
$PSNativeCommandUseErrorActionPreference = $false
$dockerConfigPath = "d:\Project1\.docker"
if (-not (Test-Path $dockerConfigPath)) {
    New-Item -ItemType Directory -Path $dockerConfigPath -Force | Out-Null
}
$env:DOCKER_CONFIG = $dockerConfigPath

function Invoke-DbScalar {
    param(
        [string]$Database,
        [string]$Sql
    )
    $escaped = $Sql.Replace('"', '\"')
    $value = docker exec -e PGPASSWORD=$DbPassword $ContainerName psql -U $DbAdmin -d $Database -v ON_ERROR_STOP=1 -t -A -c $escaped
    if ($LASTEXITCODE -ne 0) {
        throw "psql scalar query failed against database '$Database'."
    }
    return ($value | Out-String).Trim()
}

function Assert-ObjectExists {
    param(
        [string]$Database,
        [string]$ObjectName,
        [string]$ExpectedKind
    )

    $kind = Invoke-DbScalar -Database $Database -Sql "SELECT relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='$ObjectName' LIMIT 1;"
    if ([string]::IsNullOrWhiteSpace($kind)) {
        throw "Missing database object: public.$ObjectName"
    }
    if ($kind -ne $ExpectedKind) {
        throw "Object public.$ObjectName has unexpected relkind '$kind', expected '$ExpectedKind'."
    }
}

function Assert-Zero {
    param(
        [string]$Database,
        [string]$CheckName,
        [string]$Sql
    )

    $result = Invoke-DbScalar -Database $Database -Sql $Sql
    $value = 0
    if (-not [int]::TryParse($result, [ref]$value)) {
        throw "Check '$CheckName' returned non-integer result: '$result'"
    }
    if ($value -ne 0) {
        throw "Check failed: $CheckName returned $value (expected 0)."
    }
    Write-Host "PASS  $CheckName"
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

Write-Host "Validating cutover objects on database '$TargetDb'..."
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

$compatViews = @(
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

foreach ($t in $finalTables) {
    Assert-ObjectExists -Database $TargetDb -ObjectName $t -ExpectedKind "r"
}
foreach ($v in $compatViews) {
    Assert-ObjectExists -Database $TargetDb -ObjectName $v -ExpectedKind "v"
}

Write-Host "Running critical integrity checks..."
Assert-Zero -Database $TargetDb -CheckName "application_sections_orphans" -Sql "SELECT COUNT(*) FROM application_sections s LEFT JOIN applications a ON a.id = s.application_id WHERE a.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "review_cases_orphans" -Sql "SELECT COUNT(*) FROM review_cases rc LEFT JOIN applications a ON a.id = rc.application_id WHERE a.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "integration_requests_orphans" -Sql "SELECT COUNT(*) FROM integration_requests ir LEFT JOIN review_cases rc ON rc.id = ir.review_case_id WHERE rc.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "supplier_registry_profiles_user_orphans" -Sql "SELECT COUNT(*) FROM supplier_registry_profiles srp LEFT JOIN users u ON u.id = srp.supplier_user_id WHERE u.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "evaluations_orphans" -Sql "SELECT COUNT(*) FROM evaluations e LEFT JOIN supplier_registry_profiles srp ON srp.id = e.supplier_registry_profile_id WHERE srp.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "evaluation_dimensions_orphans" -Sql "SELECT COUNT(*) FROM evaluation_dimensions ed LEFT JOIN evaluations e ON e.id = ed.evaluation_id WHERE e.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "audit_events_actor_orphans" -Sql "SELECT COUNT(*) FROM audit_events ae LEFT JOIN users u ON u.id = ae.actor_user_id WHERE ae.actor_user_id IS NOT NULL AND u.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "user_admin_roles_orphans" -Sql "SELECT COUNT(*) FROM user_admin_roles uar LEFT JOIN users u ON u.id = uar.user_id WHERE u.id IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "application_sections_latest_conflicts" -Sql "SELECT COUNT(*) FROM (SELECT application_id, section_key FROM application_sections GROUP BY application_id, section_key HAVING SUM(CASE WHEN is_latest THEN 1 ELSE 0 END) <> 1) x;"
Assert-Zero -Database $TargetDb -CheckName "submitted_without_protocol" -Sql "SELECT COUNT(*) FROM applications WHERE status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED') AND (protocol_code IS NULL OR btrim(protocol_code)='');"
Assert-Zero -Database $TargetDb -CheckName "submitted_without_submitted_at" -Sql "SELECT COUNT(*) FROM applications WHERE status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED') AND submitted_at IS NULL;"
Assert-Zero -Database $TargetDb -CheckName "submitted_albo_a_required_json_paths" -Sql @"
SELECT COUNT(*)
FROM applications a
LEFT JOIN LATERAL (
    SELECT payload_json
    FROM application_sections s
    WHERE s.application_id = a.id
      AND s.section_key = 'S1'
      AND s.is_latest = true
    LIMIT 1
) s1 ON true
LEFT JOIN LATERAL (
    SELECT payload_json
    FROM application_sections s
    WHERE s.application_id = a.id
      AND s.section_key = 'S5'
      AND s.is_latest = true
    LIMIT 1
) s5 ON true
WHERE a.status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
  AND a.registry_type = 'ALBO_A'
  AND (
    s1.payload_json IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'firstName', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'lastName', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'taxCode', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'phone', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'email', '')), '') IS NULL
    OR s5.payload_json IS NULL
    OR COALESCE(s5.payload_json->>'truthfulnessDeclaration', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'noConflictOfInterest', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'noCriminalConvictions', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'privacyAccepted', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'ethicalCodeAccepted', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'qualityEnvSafetyAccepted', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'alboDataProcessingConsent', 'false') <> 'true'
  );
"@
Assert-Zero -Database $TargetDb -CheckName "submitted_albo_b_required_json_paths" -Sql @"
SELECT COUNT(*)
FROM applications a
LEFT JOIN LATERAL (
    SELECT payload_json
    FROM application_sections s
    WHERE s.application_id = a.id
      AND s.section_key = 'S1'
      AND s.is_latest = true
    LIMIT 1
) s1 ON true
LEFT JOIN LATERAL (
    SELECT payload_json
    FROM application_sections s
    WHERE s.application_id = a.id
      AND s.section_key = 'S5'
      AND s.is_latest = true
    LIMIT 1
) s5 ON true
WHERE a.status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
  AND a.registry_type = 'ALBO_B'
  AND (
    s1.payload_json IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'companyName', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'vatNumber', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'reaNumber', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'institutionalEmail', '')), '') IS NULL
    OR NULLIF(BTRIM(COALESCE(s1.payload_json->>'phone', '')), '') IS NULL
    OR s5.payload_json IS NULL
    OR COALESCE(s5.payload_json->>'truthfulnessDeclaration', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'noConflictOfInterest', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'noCriminalConvictions', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'privacyAccepted', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'ethicalCodeAccepted', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'qualityEnvSafetyAccepted', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'alboDataProcessingConsent', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'antimafiaDeclaration', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'dlgs231Declaration', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'fiscalContributionRegularity', 'false') <> 'true'
    OR COALESCE(s5.payload_json->>'gdprComplianceAndDpo', 'false') <> 'true'
  );
"@
Assert-Zero -Database $TargetDb -CheckName "submitted_albo_a_s4_cv_attachment_reference" -Sql @"
SELECT COUNT(*)
FROM applications a
LEFT JOIN LATERAL (
    SELECT payload_json
    FROM application_sections s
    WHERE s.application_id = a.id
      AND s.section_key = 'S4'
      AND s.is_latest = true
    LIMIT 1
) s4 ON true
WHERE a.status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
  AND a.registry_type = 'ALBO_A'
  AND (
    s4.payload_json IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(s4.payload_json->'attachments', '[]'::jsonb)) item
      WHERE UPPER(COALESCE(item->>'documentType', '')) = 'CV'
    )
  );
"@
Assert-Zero -Database $TargetDb -CheckName "submitted_albo_b_s4_required_attachment_references" -Sql @"
SELECT COUNT(*)
FROM applications a
LEFT JOIN LATERAL (
    SELECT payload_json
    FROM application_sections s
    WHERE s.application_id = a.id
      AND s.section_key = 'S4'
      AND s.is_latest = true
    LIMIT 1
) s4 ON true
WHERE a.status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
  AND a.registry_type = 'ALBO_B'
  AND (
    s4.payload_json IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(s4.payload_json->'attachments', '[]'::jsonb)) item
      WHERE UPPER(COALESCE(item->>'documentType', '')) = 'VISURA_CAMERALE'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(s4.payload_json->'attachments', '[]'::jsonb)) item
      WHERE UPPER(COALESCE(item->>'documentType', '')) = 'DURC'
    )
  );
"@

if ($StrictLegacyParity) {
    Write-Host "Running strict legacy parity checks..."
    Assert-Zero -Database $TargetDb -CheckName "approved_legacy_without_revamp_link" -Sql "SELECT COUNT(*) FROM supplier_profiles sp LEFT JOIN applications a ON a.legacy_supplier_profile_id = sp.id WHERE sp.status IN ('APPROVED','ACTIVE') AND a.id IS NULL;"
}
else {
    $parityCount = Invoke-DbScalar -Database $TargetDb -Sql "SELECT COUNT(*) FROM supplier_profiles sp LEFT JOIN applications a ON a.legacy_supplier_profile_id = sp.id WHERE sp.status IN ('APPROVED','ACTIVE') AND a.id IS NULL;"
    Write-Host "INFO  approved_legacy_without_revamp_link=$parityCount (strict parity not enforced)"
}

Write-Host "Cutover readiness validation completed successfully."
