package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.revamp.dto.RevampReportAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampReportFilterParams;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.dto.RevampReportKpisDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampReportService;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/reports")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampReportController {

    private final RevampReportService reportService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping("/kpis")
    public ResponseEntity<ApiResponse<RevampReportKpisDto>> kpis() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(reportService.getKpis()));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<RevampReportAnalyticsDto>> analytics(
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "periodFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodFrom,
            @RequestParam(name = "periodTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodTo,
            @RequestParam(name = "registryType", required = false) String registryType,
            @RequestParam(name = "groupCompany", required = false) String groupCompany,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "profileStatus", required = false) String profileStatus,
            @RequestParam(name = "ratingBand", required = false) String ratingBand
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        RevampReportFilterParams filters = new RevampReportFilterParams(
                year,
                periodFrom,
                periodTo,
                registryType,
                groupCompany,
                category,
                profileStatus,
                ratingBand
        );
        return ResponseEntity.ok(ApiResponse.ok(reportService.getAnalytics(filters)));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(name = "type", defaultValue = "kpis") String type,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "fields", required = false) List<String> fields,
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "periodFrom", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodFrom,
            @RequestParam(name = "periodTo", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodTo,
            @RequestParam(name = "registryType", required = false) String registryType,
            @RequestParam(name = "groupCompany", required = false) String groupCompany,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "profileStatus", required = false) String profileStatus,
            @RequestParam(name = "ratingBand", required = false) String ratingBand
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        RevampReportFilterParams filters = new RevampReportFilterParams(
                year,
                periodFrom,
                periodTo,
                registryType,
                groupCompany,
                category,
                profileStatus,
                ratingBand
        );
        if ("report".equalsIgnoreCase(type)) {
            byte[] excel = reportService.exportReportExcel(filters);
            String filename = "revamp_report_filtered_" + timestamp + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excel);
        }
        if ("albo".equalsIgnoreCase(type)) {
            byte[] excel = reportService.exportAlboExcel();
            String filename = "albo_completo_" + timestamp + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excel);
        }
        if ("queue".equalsIgnoreCase(type)) {
            byte[] excel = reportService.exportQueueExcel();
            String filename = "candidature_pendenti_" + timestamp + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excel);
        }
        if ("eval".equalsIgnoreCase(type)) {
            byte[] excel = reportService.exportEvaluationsExcel(year);
            String filename = "report_valutazioni_" + timestamp + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excel);
        }
        if ("annual".equalsIgnoreCase(type)) {
            byte[] excel = reportService.exportAnnualExcel(year);
            String filename = "statistiche_annuali_" + (year != null ? year : "all") + "_" + timestamp + ".xlsx";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(excel);
        }

        byte[] csv = reportService.exportKpisCsv();
        String filename = "revamp_kpis_" + timestamp + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user.getId();
        }
        return null;
    }
}


