package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampReportAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampReportFilterParams;
import com.supplierplatform.revamp.dto.RevampReportKpisDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampReportService {

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public RevampReportKpisDto getKpis() {
        return getFilteredKpis(null);
    }

    @Transactional(readOnly = true)
    public byte[] exportKpisCsv() {
        RevampReportKpisDto kpis = getKpis();
        String csv = "metric,value\n" +
                "totalSuppliers," + kpis.totalSuppliers() + "\n" +
                "activeSuppliers," + kpis.activeSuppliers() + "\n" +
                "pendingSuppliers," + kpis.pendingSuppliers() + "\n" +
                "submittedApplications," + kpis.submittedApplications() + "\n" +
                "pendingInvites," + kpis.pendingInvites() + "\n";
        return csv.getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] exportAlboExcel() {
        return buildWorkbookFromWhere("WHERE p.status IN ('APPROVED','RENEWAL_DUE')");
    }

    @Transactional(readOnly = true)
    public byte[] exportQueueExcel() {
        return buildWorkbookFromWhere(
                "WHERE EXISTS (" +
                "  SELECT 1 FROM applications a2 WHERE a2.id = p.application_id" +
                "  AND a2.status IN ('SUBMITTED','PENDING_REVIEW'))");
    }

    @Transactional(readOnly = true)
    public byte[] exportEvaluationsExcel(Integer year) {
        StringBuilder where = new StringBuilder(
                "WHERE EXISTS (" +
                "  SELECT 1 FROM evaluations e" +
                "  WHERE e.supplier_registry_profile_id = p.id");
        if (year != null) where.append(" AND EXTRACT(YEAR FROM e.created_at) = ").append(year);
        where.append(")");
        return buildWorkbookFromWhere(where.toString());
    }

    @Transactional(readOnly = true)
    public byte[] exportAnnualExcel(Integer year) {
        String where = year != null
                ? "WHERE EXTRACT(YEAR FROM p.created_at) = " + year
                : "WHERE 1=1";
        return buildWorkbookFromWhere(where);
    }

    @Transactional(readOnly = true)
    public byte[] exportReportExcel(RevampReportFilterParams filters) {
        return buildWorkbookFromWhere(profileWhereClause(filters, "p", "d"));
    }

    private byte[] buildWorkbookFromWhere(String where) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            writeRevampSuppliersSheet(wb, where);
            writeRevampContactsSheet(wb, where);
            writeRevampCategoriesSheet(wb, where);
            writeRevampDocumentsSheet(wb, where);
            writeRevampReviewsSheet(wb, where);
            writeRevampStatusHistorySheet(wb, where);
            wb.write(bos);
            return bos.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Failed to generate Excel export", ex);
        }
    }

    private void writeRevampSuppliersSheet(XSSFWorkbook wb, String where) {
        String sql = "SELECT p.id::text AS profile_id, p.registry_type, p.status, " +
                "COALESCE(p.display_name,'') AS display_name, " +
                "COALESCE(u.email,'') AS email, '' AS full_name, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'pIva'," +
                "  d.projected_json->'sections'->'S1'->>'vatNumber','') AS vat_number, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'codiceFiscale'," +
                "  d.projected_json->'sections'->'S1'->>'taxId','') AS tax_id, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'website','') AS website, " +
                "COALESCE(d.projected_json->'sections'->'S2'->>'tipologia'," +
                "  d.projected_json->'adminCardView'->>'type','') AS tipologia, " +
                "COALESCE(d.search_ateco_primary,'') AS ateco, " +
                "COALESCE(d.search_regions_csv,'') AS regions, " +
                "COALESCE(d.search_service_categories_csv,'') AS service_categories, " +
                "COALESCE(d.search_certifications_csv,'') AS certifications, " +
                "COALESCE(p.aggregate_score::text,'') AS score, " +
                "p.is_visible, p.approved_at, p.expires_at, p.created_at " +
                "FROM supplier_registry_profiles p " +
                "LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id " +
                "LEFT JOIN users u ON u.id = p.supplier_user_id " +
                where + " ORDER BY p.created_at DESC";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        XSSFSheet sheet = wb.createSheet("Suppliers");
        String[] headers = {"supplier_id", "registry_type", "status", "display_name",
                "user_email", "user_full_name", "vat_number", "tax_id", "website",
                "tipologia", "ateco", "regions", "service_categories", "certifications",
                "aggregate_score", "is_visible", "approved_at", "expires_at", "created_at"};
        writeRevampHeader(sheet, headers);
        int rowIdx = 1;
        for (Map<String, Object> row : rows) {
            Row r = sheet.createRow(rowIdx++);
            r.createCell(0).setCellValue(str(row.get("profile_id")));
            r.createCell(1).setCellValue(str(row.get("registry_type")));
            r.createCell(2).setCellValue(str(row.get("status")));
            r.createCell(3).setCellValue(str(row.get("display_name")));
            r.createCell(4).setCellValue(str(row.get("email")));
            r.createCell(5).setCellValue(str(row.get("full_name")));
            r.createCell(6).setCellValue(str(row.get("vat_number")));
            r.createCell(7).setCellValue(str(row.get("tax_id")));
            r.createCell(8).setCellValue(str(row.get("website")));
            r.createCell(9).setCellValue(str(row.get("tipologia")));
            r.createCell(10).setCellValue(str(row.get("ateco")));
            r.createCell(11).setCellValue(str(row.get("regions")));
            r.createCell(12).setCellValue(str(row.get("service_categories")));
            r.createCell(13).setCellValue(str(row.get("certifications")));
            r.createCell(14).setCellValue(str(row.get("score")));
            r.createCell(15).setCellValue(Boolean.TRUE.equals(row.get("is_visible")) ? "true" : "false");
            r.createCell(16).setCellValue(str(row.get("approved_at")));
            r.createCell(17).setCellValue(str(row.get("expires_at")));
            r.createCell(18).setCellValue(str(row.get("created_at")));
        }
        autoSizeRevamp(sheet, headers.length);
    }

    private void writeRevampContactsSheet(XSSFWorkbook wb, String where) {
        String sql = "SELECT p.id::text AS profile_id, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'firstName'," +
                "  d.projected_json->'sections'->'S1'->>'legalRepresentativeName'," +
                "  p.display_name,'') AS first_name, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'lastName','') AS last_name, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'email', u.email,'') AS contact_email, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'jobTitle'," +
                "  d.projected_json->'sections'->'S1'->>'ruolo','') AS job_title, " +
                "COALESCE(d.projected_json->'sections'->'S1'->>'phone'," +
                "  d.projected_json->'sections'->'S1'->>'phoneNumber'," +
                "  d.projected_json->'sections'->'S1'->>'celPhone','') AS phone, " +
                "p.created_at " +
                "FROM supplier_registry_profiles p " +
                "LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id " +
                "LEFT JOIN users u ON u.id = p.supplier_user_id " +
                where + " ORDER BY p.created_at DESC";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        XSSFSheet sheet = wb.createSheet("Supplier Contacts");
        String[] headers = {"supplier_id", "contact_id", "full_name", "email",
                "contact_type", "job_title", "phone", "is_primary", "created_at"};
        writeRevampHeader(sheet, headers);
        int rowIdx = 1;
        for (Map<String, Object> row : rows) {
            Row r = sheet.createRow(rowIdx++);
            r.createCell(0).setCellValue(str(row.get("profile_id")));
            r.createCell(1).setCellValue("");
            String fullName = (str(row.get("first_name")) + " " + str(row.get("last_name"))).trim();
            r.createCell(2).setCellValue(fullName);
            r.createCell(3).setCellValue(str(row.get("contact_email")));
            r.createCell(4).setCellValue("PRIMARY");
            r.createCell(5).setCellValue(str(row.get("job_title")));
            r.createCell(6).setCellValue(str(row.get("phone")));
            r.createCell(7).setCellValue("true");
            r.createCell(8).setCellValue(str(row.get("created_at")));
        }
        autoSizeRevamp(sheet, headers.length);
    }

    private void writeRevampCategoriesSheet(XSSFWorkbook wb, String where) {
        String sql = "SELECT p.id::text AS profile_id, " +
                "COALESCE(d.search_service_categories_csv,'') AS categories_csv " +
                "FROM supplier_registry_profiles p " +
                "LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id " +
                where + " ORDER BY p.created_at DESC";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        XSSFSheet sheet = wb.createSheet("Supplier Categories");
        String[] headers = {"supplier_id", "category_id", "code", "name", "parent_id", "is_active"};
        writeRevampHeader(sheet, headers);
        int rowIdx = 1;
        for (Map<String, Object> row : rows) {
            String profileId = str(row.get("profile_id"));
            String csv = str(row.get("categories_csv"));
            if (csv.isBlank()) {
                Row r = sheet.createRow(rowIdx++);
                r.createCell(0).setCellValue(profileId);
                for (int i = 1; i < headers.length; i++) r.createCell(i).setCellValue("");
            } else {
                for (String cat : csv.split(",")) {
                    String code = cat.trim();
                    if (code.isEmpty()) continue;
                    Row r = sheet.createRow(rowIdx++);
                    r.createCell(0).setCellValue(profileId);
                    r.createCell(1).setCellValue("");
                    r.createCell(2).setCellValue(code);
                    r.createCell(3).setCellValue(code);
                    r.createCell(4).setCellValue("");
                    r.createCell(5).setCellValue("true");
                }
            }
        }
        autoSizeRevamp(sheet, headers.length);
    }

    private void writeRevampDocumentsSheet(XSSFWorkbook wb, String where) {
        String sql = "SELECT p.id::text AS profile_id, " +
                "a.id::text AS attachment_id, " +
                "COALESCE(a.document_type::text,'') AS document_type, " +
                "COALESCE(a.file_name,'') AS file_name, " +
                "COALESCE(a.mime_type,'') AS mime_type, " +
                "COALESCE(a.size_bytes::text,'') AS size_bytes, " +
                "COALESCE(a.expires_at::text,'') AS expires_at, " +
                "COALESCE(a.uploaded_at::text,'') AS uploaded_at, " +
                "COALESCE(u.email,'') AS user_email " +
                "FROM supplier_registry_profiles p " +
                "JOIN applications app ON app.id = p.application_id " +
                "JOIN application_attachments a ON a.application_id = app.id " +
                "LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id " +
                "LEFT JOIN users u ON u.id = p.supplier_user_id " +
                where + " ORDER BY p.id, a.uploaded_at";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        XSSFSheet sheet = wb.createSheet("Supplier Documents");
        String[] headers = {"supplier_id", "document_id", "document_type", "original_filename",
                "mime_type", "file_size_bytes", "is_current", "expiry_date",
                "notes", "uploaded_at", "uploaded_by_email"};
        writeRevampHeader(sheet, headers);
        int rowIdx = 1;
        for (Map<String, Object> row : rows) {
            Row r = sheet.createRow(rowIdx++);
            r.createCell(0).setCellValue(str(row.get("profile_id")));
            r.createCell(1).setCellValue(str(row.get("attachment_id")));
            r.createCell(2).setCellValue(str(row.get("document_type")));
            r.createCell(3).setCellValue(str(row.get("file_name")));
            r.createCell(4).setCellValue(str(row.get("mime_type")));
            r.createCell(5).setCellValue(str(row.get("size_bytes")));
            r.createCell(6).setCellValue("true");
            r.createCell(7).setCellValue(str(row.get("expires_at")));
            r.createCell(8).setCellValue("");
            r.createCell(9).setCellValue(str(row.get("uploaded_at")));
            r.createCell(10).setCellValue(str(row.get("user_email")));
        }
        autoSizeRevamp(sheet, headers.length);
    }

    private void writeRevampReviewsSheet(XSSFWorkbook wb, String where) {
        String sql = "SELECT p.id::text AS profile_id, " +
                "rc.id::text AS review_id, " +
                "COALESCE(rc.status::text,'') AS action, " +
                "COALESCE(rc.decision_reason,'') AS comment, " +
                "COALESCE(rc.verification_note,'') AS internal_note, " +
                "COALESCE(rc.decision::text,'') AS decision, " +
                "COALESCE(du.email,'') AS decided_by_email, " +
                "COALESCE(au.email,'') AS assigned_to_email, " +
                "rc.created_at " +
                "FROM supplier_registry_profiles p " +
                "JOIN applications app ON app.id = p.application_id " +
                "JOIN review_cases rc ON rc.application_id = app.id " +
                "LEFT JOIN users du ON du.id = rc.decided_by_user_id " +
                "LEFT JOIN users au ON au.id = rc.assigned_to_user_id " +
                "LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id " +
                where + " ORDER BY p.id, rc.created_at";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        XSSFSheet sheet = wb.createSheet("Validation Reviews");
        String[] headers = {"supplier_id", "review_id", "action", "comment", "internal_note",
                "previous_status", "new_status", "reviewer_email", "created_at"};
        writeRevampHeader(sheet, headers);
        int rowIdx = 1;
        for (Map<String, Object> row : rows) {
            Row r = sheet.createRow(rowIdx++);
            r.createCell(0).setCellValue(str(row.get("profile_id")));
            r.createCell(1).setCellValue(str(row.get("review_id")));
            r.createCell(2).setCellValue(str(row.get("action")));
            r.createCell(3).setCellValue(str(row.get("comment")));
            r.createCell(4).setCellValue(str(row.get("internal_note")));
            r.createCell(5).setCellValue("");
            r.createCell(6).setCellValue(str(row.get("decision")));
            String reviewer = str(row.get("decided_by_email"));
            if (reviewer.isEmpty()) reviewer = str(row.get("assigned_to_email"));
            r.createCell(7).setCellValue(reviewer);
            r.createCell(8).setCellValue(str(row.get("created_at")));
        }
        autoSizeRevamp(sheet, headers.length);
    }

    private void writeRevampStatusHistorySheet(XSSFWorkbook wb, String where) {
        String sql = "SELECT p.id::text AS profile_id, " +
                "ae.id::text AS history_id, " +
                "COALESCE(ae.before_state_json->>'status','') AS from_status, " +
                "COALESCE(ae.after_state_json->>'status','') AS to_status, " +
                "COALESCE(au.email,'') AS changed_by_email, " +
                "COALESCE(ae.reason,'') AS reason, " +
                "ae.occurred_at AS created_at " +
                "FROM supplier_registry_profiles p " +
                "JOIN audit_events ae ON ae.entity_id = p.id " +
                "  AND ae.entity_type IN ('REVAMP_SUPPLIER_PROFILE','REVAMP_SUPPLIER_REGISTRY_PROFILE') " +
                "LEFT JOIN users au ON au.id = ae.actor_user_id " +
                "LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id " +
                where + " ORDER BY p.id, ae.occurred_at";
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        XSSFSheet sheet = wb.createSheet("Status History");
        String[] headers = {"supplier_id", "history_id", "from_status", "to_status",
                "changed_by_email", "reason", "created_at"};
        writeRevampHeader(sheet, headers);
        int rowIdx = 1;
        for (Map<String, Object> row : rows) {
            Row r = sheet.createRow(rowIdx++);
            r.createCell(0).setCellValue(str(row.get("profile_id")));
            r.createCell(1).setCellValue(str(row.get("history_id")));
            r.createCell(2).setCellValue(str(row.get("from_status")));
            r.createCell(3).setCellValue(str(row.get("to_status")));
            r.createCell(4).setCellValue(str(row.get("changed_by_email")));
            r.createCell(5).setCellValue(str(row.get("reason")));
            r.createCell(6).setCellValue(str(row.get("created_at")));
        }
        autoSizeRevamp(sheet, headers.length);
    }

    private void writeRevampHeader(XSSFSheet sheet, String[] headers) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) row.createCell(i).setCellValue(headers[i]);
    }

    private void autoSizeRevamp(XSSFSheet sheet, int columns) {
        for (int i = 0; i < columns; i++) sheet.autoSizeColumn(i);
    }

    private String str(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    @Transactional(readOnly = true)
    public RevampReportAnalyticsDto getAnalytics() {
        return getAnalytics(null);
    }

    @Transactional(readOnly = true)
    public RevampReportAnalyticsDto getAnalytics(RevampReportFilterParams filters) {
        RevampReportKpisDto kpis = getFilteredKpis(filters);
        String profileWhere = profileWhereClause(filters, "p", "d");

        long alboAActive = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles
                WHERE registry_type = 'ALBO_A'
                  AND status IN ('APPROVED', 'RENEWAL_DUE')
                """);
        long alboBActive = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles
                WHERE registry_type = 'ALBO_B'
                  AND status IN ('APPROVED', 'RENEWAL_DUE')
                """);
        if (filters != null && filters.registryType() != null && !filters.registryType().isBlank()) {
            String rt = filters.registryType().trim().toUpperCase();
            if ("ALBO_A".equals(rt)) {
                alboBActive = 0L;
            } else if ("ALBO_B".equals(rt)) {
                alboAActive = 0L;
            }
        }
        if (hasProfileFilters(filters)) {
            alboAActive = count("""
                    SELECT COUNT(*)
                    FROM supplier_registry_profiles p
                    LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                    """ + profileWhere + """
                    AND p.registry_type = 'ALBO_A'
                    AND p.status IN ('APPROVED', 'RENEWAL_DUE')
                    """);
            alboBActive = count("""
                    SELECT COUNT(*)
                    FROM supplier_registry_profiles p
                    LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                    """ + profileWhere + """
                    AND p.registry_type = 'ALBO_B'
                    AND p.status IN ('APPROVED', 'RENEWAL_DUE')
                    """);
        }

        Integer targetYear = filters != null ? filters.year() : null;
        long newRegistrationsYtd = targetYear != null
                ? count("""
                    SELECT COUNT(*)
                    FROM applications
                    WHERE submitted_at IS NOT NULL
                      AND EXTRACT(YEAR FROM submitted_at) = ?
                    """, targetYear)
                : count("""
                    SELECT COUNT(*)
                    FROM applications
                    WHERE submitted_at IS NOT NULL
                    """);

        long evaluationsYtd = targetYear != null
                ? count("""
                    SELECT COUNT(*)
                    FROM evaluations e
                    JOIN supplier_registry_profiles p ON p.id = e.supplier_registry_profile_id
                    LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                    WHERE EXTRACT(YEAR FROM e.created_at) = ?
                    """ + profileFilterTail(filters, "p", "d"), targetYear)
                : count("""
                    SELECT COUNT(*)
                    FROM evaluations e
                    JOIN supplier_registry_profiles p ON p.id = e.supplier_registry_profile_id
                    LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                    WHERE 1=1
                    """ + profileFilterTail(filters, "p", "d"));

        long approvedApplications = count("SELECT COUNT(*) FROM applications WHERE status = 'APPROVED'");
        long rejectedApplications = count("SELECT COUNT(*) FROM applications WHERE status = 'REJECTED'");
        double approvalRatePct = approvedApplications + rejectedApplications > 0
                ? (approvedApplications * 100.0) / (approvedApplications + rejectedApplications)
                : 0d;

        List<RevampReportAnalyticsDto.MonthlyPointDto> monthlyPoints = buildMonthlyPoints(filters);
        List<RevampReportAnalyticsDto.TopicRankingRowDto> thematicRanking = buildThematicRanking(filters);
        List<RevampReportAnalyticsDto.DistributionRowDto> distribution = buildDistributionRows();
        List<RevampReportAnalyticsDto.TopSupplierRowDto> topSuppliers = buildTopSuppliers(filters);

        return new RevampReportAnalyticsDto(
                kpis,
                alboAActive,
                alboBActive,
                newRegistrationsYtd,
                evaluationsYtd,
                round1(approvalRatePct),
                monthlyPoints,
                thematicRanking,
                distribution,
                topSuppliers
        );
    }

    private List<RevampReportAnalyticsDto.MonthlyPointDto> buildMonthlyPoints(RevampReportFilterParams filters) {
        Integer targetYear = filters != null ? filters.year() : null;
        String registryTypeClause = (filters != null && filters.registryType() != null && !filters.registryType().isBlank())
                ? " AND registry_type = ? "
                : "";
        List<Object> args = new ArrayList<>();
        if (targetYear != null) {
            args.add(targetYear);
        }
        if (!registryTypeClause.isBlank()) {
            args.add(filters.registryType().trim().toUpperCase());
        }
        if (targetYear == null) {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                    SELECT
                        EXTRACT(YEAR FROM submitted_at)::int AS y,
                        SUM(CASE WHEN registry_type = 'ALBO_A' THEN 1 ELSE 0 END)::bigint AS albo_a,
                        SUM(CASE WHEN registry_type = 'ALBO_B' THEN 1 ELSE 0 END)::bigint AS albo_b
                    FROM applications
                    WHERE submitted_at IS NOT NULL
                    """ + registryTypeClause + """
                    GROUP BY EXTRACT(YEAR FROM submitted_at)
                    ORDER BY y
                    """, args.toArray());

            List<RevampReportAnalyticsDto.MonthlyPointDto> out = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                out.add(new RevampReportAnalyticsDto.MonthlyPointDto(
                        String.valueOf(number(row.get("y")).intValue()),
                        number(row.get("albo_a")).longValue(),
                        number(row.get("albo_b")).longValue()
                ));
            }
            return out;
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    EXTRACT(MONTH FROM submitted_at)::int AS m,
                    SUM(CASE WHEN registry_type = 'ALBO_A' THEN 1 ELSE 0 END)::bigint AS albo_a,
                    SUM(CASE WHEN registry_type = 'ALBO_B' THEN 1 ELSE 0 END)::bigint AS albo_b
                FROM applications
                WHERE submitted_at IS NOT NULL
                  AND EXTRACT(YEAR FROM submitted_at) = ?
                """ + registryTypeClause + """
                GROUP BY EXTRACT(MONTH FROM submitted_at)
                ORDER BY m
                """, args.toArray());

        Map<Integer, long[]> byMonth = new HashMap<>();
        for (Map<String, Object> row : rows) {
            int month = number(row.get("m")).intValue();
            long alboA = number(row.get("albo_a")).longValue();
            long alboB = number(row.get("albo_b")).longValue();
            byMonth.put(month, new long[]{alboA, alboB});
        }

        String[] labels = {"Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"};
        List<RevampReportAnalyticsDto.MonthlyPointDto> out = new ArrayList<>();
        for (int month = 1; month <= 12; month++) {
            long[] values = byMonth.getOrDefault(month, new long[]{0L, 0L});
            out.add(new RevampReportAnalyticsDto.MonthlyPointDto(labels[month - 1], values[0], values[1]));
        }
        return out;
    }

    private List<RevampReportAnalyticsDto.TopicRankingRowDto> buildThematicRanking(RevampReportFilterParams filters) {
        String registryTypeClause = (filters != null && filters.registryType() != null && !filters.registryType().isBlank())
                ? " AND a.registry_type = ? "
                : " AND a.registry_type = 'ALBO_A' ";
        List<Object> args = new ArrayList<>();
        if (filters != null && filters.registryType() != null && !filters.registryType().isBlank()) {
            args.add(filters.registryType().trim().toUpperCase());
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT label, cnt
                FROM (
                    SELECT
                        NULLIF(BTRIM(comp->>'theme'), '') AS label,
                        COUNT(*)::bigint AS cnt
                    FROM application_sections s
                    JOIN applications a ON a.id = s.application_id
                    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.payload_json->'competencies', '[]'::jsonb)) comp
                    WHERE s.section_key = 'S3A'
                      AND s.is_latest = TRUE
                """ + registryTypeClause + """
                    GROUP BY NULLIF(BTRIM(comp->>'theme'), '')
                ) x
                WHERE label IS NOT NULL
                ORDER BY cnt DESC, label ASC
                LIMIT 7
                """, args.toArray());

        if (rows.isEmpty()) {
            rows = jdbcTemplate.queryForList("""
                    SELECT
                        NULLIF(BTRIM(service), '') AS label,
                        COUNT(*)::bigint AS cnt
                    FROM application_sections s
                    JOIN applications a ON a.id = s.application_id
                    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.payload_json->'services', '[]'::jsonb)) service
                    WHERE s.section_key = 'S3B'
                      AND s.is_latest = TRUE
                """ + registryTypeClause + """
                    GROUP BY NULLIF(BTRIM(service), '')
                    HAVING NULLIF(BTRIM(service), '') IS NOT NULL
                    ORDER BY cnt DESC, label ASC
                    LIMIT 7
                    """, args.toArray());
        }

        long max = rows.stream()
                .map(row -> number(row.get("cnt")).longValue())
                .max(Comparator.naturalOrder())
                .orElse(1L);
        if (max <= 0) max = 1L;

        List<RevampReportAnalyticsDto.TopicRankingRowDto> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String label = Optional.ofNullable((String) row.get("label"))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .orElse("Altro");
            long value = number(row.get("cnt")).longValue();
            int pct = (int) Math.max(0, Math.min(100, Math.round((value * 100.0) / max)));
            out.add(new RevampReportAnalyticsDto.TopicRankingRowDto(label, value, pct));
        }
        return out;
    }

    private List<RevampReportAnalyticsDto.DistributionRowDto> buildDistributionRows() {
        long active = count("SELECT COUNT(*) FROM supplier_registry_profiles WHERE status IN ('APPROVED','RENEWAL_DUE')");
        long suspended = count("SELECT COUNT(*) FROM supplier_registry_profiles WHERE status IN ('SUSPENDED')");
        long waiting = count("SELECT COUNT(*) FROM supplier_registry_profiles WHERE status IN ('PENDING','UNDER_REVIEW')");
        long rejected = count("SELECT COUNT(*) FROM supplier_registry_profiles WHERE status IN ('REJECTED')");
        long compiling = count("SELECT COUNT(*) FROM applications WHERE status IN ('DRAFT','IN_PROGRESS')");
        return List.of(
                new RevampReportAnalyticsDto.DistributionRowDto("Attivi", active),
                new RevampReportAnalyticsDto.DistributionRowDto("Sospesi", suspended),
                new RevampReportAnalyticsDto.DistributionRowDto("In attesa", waiting),
                new RevampReportAnalyticsDto.DistributionRowDto("Rigettati", rejected),
                new RevampReportAnalyticsDto.DistributionRowDto("In comp.", compiling)
        );
    }

    private List<RevampReportAnalyticsDto.TopSupplierRowDto> buildTopSuppliers(RevampReportFilterParams filters) {
        String profileWhere = profileWhereClause(filters, "srp", "d");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT
                    COALESCE(NULLIF(BTRIM(srp.display_name), ''), 'Fornitore') AS name,
                    srp.registry_type AS registry_type,
                    ROUND(AVG(e.overall_score)::numeric, 1) AS avg_score,
                    COUNT(*)::bigint AS eval_count
                FROM evaluations e
                JOIN supplier_registry_profiles srp ON srp.id = e.supplier_registry_profile_id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = srp.id
                WHERE 1=1
                """ + profileFilterTail(filters, "srp", "d") + """
                GROUP BY COALESCE(NULLIF(BTRIM(srp.display_name), ''), 'Fornitore'), srp.registry_type
                ORDER BY avg_score DESC, eval_count DESC, name ASC
                LIMIT 5
                """);

        List<RevampReportAnalyticsDto.TopSupplierRowDto> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String name = Optional.ofNullable((String) row.get("name")).orElse("Fornitore");
            String registryType = Optional.ofNullable((String) row.get("registry_type")).orElse("");
            String subtitle = "ALBO_A".equalsIgnoreCase(registryType) ? "Albo A" : "Albo B";
            double avg = number(row.get("avg_score")).doubleValue();
            long count = number(row.get("eval_count")).longValue();
            out.add(new RevampReportAnalyticsDto.TopSupplierRowDto(name, subtitle, round1(avg), count));
        }
        return out;
    }

    private long count(String sql, Object... args) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class, args);
        return value == null ? 0L : value;
    }

    private RevampReportKpisDto getFilteredKpis(RevampReportFilterParams filters) {
        String where = profileWhereClause(filters, "p", "d");
        long totalSuppliers = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles p
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                """ + where);
        long activeSuppliers = count("""
                SELECT COUNT(*)
                FROM supplier_registry_profiles p
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                """ + where + """
                AND p.status IN ('APPROVED', 'RENEWAL_DUE')
                """);
        long pendingSuppliers = count("""
                SELECT COUNT(*)
                FROM applications a
                LEFT JOIN supplier_registry_profiles p ON p.application_id = a.id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                WHERE a.status IN ('SUBMITTED', 'UNDER_REVIEW')
                """ + applicationFilterTail(filters, "a", "p", "d"));
        long submittedApplications = count("""
                SELECT COUNT(*)
                FROM applications a
                LEFT JOIN supplier_registry_profiles p ON p.application_id = a.id
                LEFT JOIN supplier_registry_profile_details d ON d.profile_id = p.id
                WHERE a.status = 'SUBMITTED'
                """ + applicationFilterTail(filters, "a", "p", "d"));
        long pendingInvites = count("""
                SELECT COUNT(*)
                FROM invites i
                WHERE i.status = 'SENT'
                """ + inviteFilterTail(filters, "i"));
        return new RevampReportKpisDto(totalSuppliers, activeSuppliers, pendingSuppliers, submittedApplications, pendingInvites);
    }

    private String profileWhereClause(RevampReportFilterParams filters, String profileAlias, String detailsAlias) {
        return "WHERE 1=1 " + profileFilterTail(filters, profileAlias, detailsAlias);
    }

    private String profileFilterTail(RevampReportFilterParams filters, String profileAlias, String detailsAlias) {
        if (filters == null) return "";
        StringBuilder out = new StringBuilder();
        if (hasText(filters.registryType())) {
            out.append(" AND ").append(profileAlias).append(".registry_type = '").append(escapeLiteral(filters.registryType().trim().toUpperCase())).append("' ");
        }
        if (hasText(filters.profileStatus())) {
            out.append(" AND ").append(profileAlias).append(".status = '").append(escapeLiteral(filters.profileStatus().trim().toUpperCase())).append("' ");
        }
        if (hasText(filters.groupCompany())) {
            out.append(" AND COALESCE(").append(detailsAlias).append(".projected_json->>'groupCompany','') = '")
                    .append(escapeLiteral(filters.groupCompany().trim())).append("' ");
        }
        if (hasText(filters.category())) {
            String cat = escapeLiteral(filters.category().trim().toUpperCase());
            out.append(" AND (UPPER(COALESCE(").append(detailsAlias).append(".projected_json->>'category','')) = '").append(cat).append("' ")
                    .append(" OR UPPER(COALESCE(").append(detailsAlias).append(".search_service_categories_csv,'')) LIKE '%").append(cat).append("%'")
                    .append(" OR UPPER(COALESCE(").append(detailsAlias).append(".projected_json->'sections'->'S2'->>'tipologia','')) = '").append(cat).append("'")
                    .append(" OR UPPER(COALESCE(").append(detailsAlias).append(".projected_json->'sections'->'S2'->>'professionalType','')) = '").append(cat).append("') ");
        }
        if (filters.year() != null) {
            out.append(" AND EXTRACT(YEAR FROM ").append(profileAlias).append(".created_at) = ").append(filters.year()).append(" ");
        }
        if (filters.periodFrom() != null) {
            out.append(" AND ").append(profileAlias).append(".created_at::date >= '").append(filters.periodFrom()).append("' ");
        }
        if (filters.periodTo() != null) {
            out.append(" AND ").append(profileAlias).append(".created_at::date <= '").append(filters.periodTo()).append("' ");
        }
        if (hasText(filters.ratingBand())) {
            appendRatingBand(out, filters.ratingBand(), profileAlias + ".aggregate_score");
        }
        return out.toString();
    }

    private String applicationFilterTail(RevampReportFilterParams filters, String appAlias, String profileAlias, String detailsAlias) {
        if (filters == null) return "";
        StringBuilder out = new StringBuilder();
        if (hasText(filters.registryType())) {
            out.append(" AND ").append(appAlias).append(".registry_type = '").append(escapeLiteral(filters.registryType().trim().toUpperCase())).append("' ");
        }
        if (filters.year() != null) {
            out.append(" AND EXTRACT(YEAR FROM ").append(appAlias).append(".submitted_at) = ").append(filters.year()).append(" ");
        }
        if (filters.periodFrom() != null) {
            out.append(" AND ").append(appAlias).append(".submitted_at::date >= '").append(filters.periodFrom()).append("' ");
        }
        if (filters.periodTo() != null) {
            out.append(" AND ").append(appAlias).append(".submitted_at::date <= '").append(filters.periodTo()).append("' ");
        }
        out.append(profileFilterTail(filters, profileAlias, detailsAlias));
        return out.toString();
    }

    private String inviteFilterTail(RevampReportFilterParams filters, String inviteAlias) {
        if (filters == null || !hasText(filters.registryType())) return "";
        return " AND " + inviteAlias + ".registry_type = '" + escapeLiteral(filters.registryType().trim().toUpperCase()) + "' ";
    }

    private boolean hasProfileFilters(RevampReportFilterParams filters) {
        if (filters == null) return false;
        return hasText(filters.registryType())
                || hasText(filters.groupCompany())
                || hasText(filters.category())
                || hasText(filters.profileStatus())
                || hasText(filters.ratingBand())
                || filters.year() != null
                || filters.periodFrom() != null
                || filters.periodTo() != null;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String escapeLiteral(String value) {
        return value.replace("'", "''");
    }

    private void appendRatingBand(StringBuilder out, String rawBand, String scoreColumn) {
        String band = rawBand.trim().toUpperCase();
        try {
            if (band.endsWith("+")) {
                double min = Double.parseDouble(band.substring(0, band.length() - 1));
                out.append(" AND ").append(scoreColumn).append(" >= ").append(min).append(" ");
                return;
            }
            if (band.contains("-")) {
                String[] parts = band.split("-");
                if (parts.length == 2) {
                    double min = Double.parseDouble(parts[0]);
                    double max = Double.parseDouble(parts[1]);
                    out.append(" AND ").append(scoreColumn).append(" BETWEEN ").append(min).append(" AND ").append(max).append(" ");
                    return;
                }
            }
            if (band.contains("_")) {
                String[] parts = band.split("_");
                if (parts.length == 2) {
                    double min = Double.parseDouble(parts[0]);
                    double max = Double.parseDouble(parts[1]);
                    out.append(" AND ").append(scoreColumn).append(" BETWEEN ").append(min).append(" AND ").append(max).append(" ");
                    return;
                }
            }
            double min = Double.parseDouble(band);
            out.append(" AND ").append(scoreColumn).append(" >= ").append(min).append(" ");
        } catch (NumberFormatException ignored) {
            // Ignore invalid rating bands instead of failing the whole report endpoint.
        }
    }

    private Number number(Object value) {
        if (value instanceof Number n) {
            return n;
        }
        return Double.parseDouble(String.valueOf(value));
    }

    private double round1(double value) {
        return Math.round(value * 10.0d) / 10.0d;
    }

}
