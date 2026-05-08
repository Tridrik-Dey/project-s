package com.supplierplatform.ops;

import com.supplierplatform.config.RevampFeatureFlags;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OpsRevampCutoverReadinessService {

    private final JdbcTemplate jdbcTemplate;
    private final RevampFeatureFlags revampFeatureFlags;

    public CutoverSnapshot evaluate() {
        List<CheckResult> checks = new ArrayList<>();
        checks.add(checkDatabaseUp());
        checks.add(checkFinalTablesExist());
        checks.add(checkRevampViewsExist());
        checks.add(checkNoApplicationSectionOrphans());
        checks.add(checkNoReviewCaseOrphans());
        checks.add(checkNoSubmittedWithoutProtocol());
        checks.add(checkNoSubmittedWithoutSubmittedAt());

        boolean databaseUp = checks.stream()
                .filter(c -> "database_up".equals(c.name()))
                .findFirst()
                .map(CheckResult::passed)
                .orElse(false);
        boolean dbChecksPassed = checks.stream()
                .filter(c -> !"database_up".equals(c.name()))
                .allMatch(CheckResult::passed);

        boolean readEnabled = revampFeatureFlags.isReadEnabled();
        boolean writeEnabled = revampFeatureFlags.isWriteEnabled();
        boolean aliasEnabled = revampFeatureFlags.isAliasEnabled();

        boolean readyForAliasEnable = databaseUp && dbChecksPassed && readEnabled && writeEnabled;
        String status = readyForAliasEnable ? "READY" : "BLOCKED";
        List<String> blockingReasons = new ArrayList<>();
        if (!databaseUp) blockingReasons.add("database_up=false");
        if (!dbChecksPassed) blockingReasons.add("db_integrity_checks_failed");
        if (!readEnabled) blockingReasons.add("revamp_read_enabled=false");
        if (!writeEnabled) blockingReasons.add("revamp_write_enabled=false");

        return new CutoverSnapshot(
                status,
                readyForAliasEnable,
                aliasEnabled,
                readEnabled,
                writeEnabled,
                databaseUp,
                checks,
                blockingReasons
        );
    }

    private CheckResult checkDatabaseUp() {
        return executeBooleanCheck("database_up", "SELECT 1", value -> value != null && value == 1, "Expected SELECT 1 == 1");
    }

    private CheckResult checkFinalTablesExist() {
        String sql = """
                SELECT COUNT(*)
                FROM (VALUES
                    ('applications'),
                    ('application_sections'),
                    ('application_attachments'),
                    ('invites'),
                    ('otp_challenges'),
                    ('review_cases'),
                    ('integration_requests'),
                    ('supplier_registry_profiles'),
                    ('supplier_registry_profile_details'),
                    ('evaluations'),
                    ('evaluation_dimensions'),
                    ('notification_events'),
                    ('audit_events'),
                    ('user_admin_roles')
                ) AS t(name)
                WHERE to_regclass('public.' || t.name) IS NOT NULL
                """;
        return executeIntegerCheck("final_tables_exist", sql, value -> value == 14, "Expected 14 final tables");
    }

    private CheckResult checkRevampViewsExist() {
        String sql = """
                SELECT COUNT(*)
                FROM (VALUES
                    ('revamp_applications'),
                    ('revamp_application_sections'),
                    ('revamp_invites'),
                    ('revamp_otp_challenges'),
                    ('revamp_review_cases'),
                    ('revamp_integration_requests'),
                    ('revamp_supplier_registry_profiles'),
                    ('revamp_evaluations'),
                    ('revamp_evaluation_dimensions'),
                    ('revamp_notification_events'),
                    ('revamp_audit_events'),
                    ('revamp_user_admin_roles')
                ) AS v(name)
                JOIN pg_class c ON c.relname = v.name
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relkind = 'v'
                """;
        return executeIntegerCheck("revamp_views_exist", sql, value -> value == 12, "Expected 12 revamp compatibility views");
    }

    private CheckResult checkNoApplicationSectionOrphans() {
        String sql = """
                SELECT COUNT(*)
                FROM application_sections s
                LEFT JOIN applications a ON a.id = s.application_id
                WHERE a.id IS NULL
                """;
        return executeIntegerCheck("application_section_orphans", sql, value -> value == 0, "Expected 0 application_sections orphans");
    }

    private CheckResult checkNoReviewCaseOrphans() {
        String sql = """
                SELECT COUNT(*)
                FROM review_cases rc
                LEFT JOIN applications a ON a.id = rc.application_id
                WHERE a.id IS NULL
                """;
        return executeIntegerCheck("review_case_orphans", sql, value -> value == 0, "Expected 0 review_cases orphans");
    }

    private CheckResult checkNoSubmittedWithoutProtocol() {
        String sql = """
                SELECT COUNT(*)
                FROM applications
                WHERE status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
                  AND (protocol_code IS NULL OR btrim(protocol_code) = '')
                """;
        return executeIntegerCheck("submitted_without_protocol", sql, value -> value == 0, "Expected 0 submitted/reviewed rows missing protocol");
    }

    private CheckResult checkNoSubmittedWithoutSubmittedAt() {
        String sql = """
                SELECT COUNT(*)
                FROM applications
                WHERE status IN ('SUBMITTED','UNDER_REVIEW','INTEGRATION_REQUIRED','APPROVED','REJECTED','SUSPENDED','RENEWAL_DUE','ARCHIVED')
                  AND submitted_at IS NULL
                """;
        return executeIntegerCheck("submitted_without_submitted_at", sql, value -> value == 0, "Expected 0 submitted/reviewed rows missing submitted_at");
    }

    private CheckResult executeBooleanCheck(String name, String sql, java.util.function.Predicate<Integer> passCondition, String expectation) {
        try {
            Integer value = jdbcTemplate.queryForObject(sql, Integer.class);
            boolean passed = passCondition.test(value);
            return new CheckResult(name, passed, value != null ? value.toString() : "null", expectation);
        } catch (Exception ex) {
            return new CheckResult(name, false, "ERROR: " + ex.getClass().getSimpleName(), expectation);
        }
    }

    private CheckResult executeIntegerCheck(String name, String sql, java.util.function.IntPredicate passCondition, String expectation) {
        try {
            Integer value = jdbcTemplate.queryForObject(sql, Integer.class);
            int actual = value == null ? -1 : value;
            boolean passed = passCondition.test(actual);
            return new CheckResult(name, passed, String.valueOf(actual), expectation);
        } catch (Exception ex) {
            return new CheckResult(name, false, "ERROR: " + ex.getClass().getSimpleName(), expectation);
        }
    }

    public record CheckResult(
            String name,
            boolean passed,
            String actual,
            String expectation
    ) {
    }

    public record CutoverSnapshot(
            String status,
            boolean readyForAliasEnable,
            boolean aliasEnabled,
            boolean readEnabled,
            boolean writeEnabled,
            boolean databaseUp,
            List<CheckResult> checks,
            List<String> blockingReasons
    ) {
    }
}
