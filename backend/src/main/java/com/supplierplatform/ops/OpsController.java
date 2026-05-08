package com.supplierplatform.ops;

import com.supplierplatform.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/ops")
@RequiredArgsConstructor
public class OpsController {

    private final OpsHealthService opsHealthService;
    private final OpsRevampCutoverReadinessService opsRevampCutoverReadinessService;

    @GetMapping("/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> health() {
        OpsHealthService.HealthSnapshot snapshot = opsHealthService.getHealthSnapshot();
        Map<String, Object> payload = Map.of(
                "status", snapshot.status(),
                "databaseUp", snapshot.databaseUp(),
                "mailConfigValid", snapshot.mailConfigValid(),
                "timestamp", Instant.now().toString()
        );
        return ResponseEntity.ok(ApiResponse.ok("Health check completed", payload));
    }

    @GetMapping("/revamp-cutover-readiness")
    public ResponseEntity<ApiResponse<Map<String, Object>>> revampCutoverReadiness() {
        OpsRevampCutoverReadinessService.CutoverSnapshot snapshot = opsRevampCutoverReadinessService.evaluate();
        Map<String, Object> payload = Map.of(
                "status", snapshot.status(),
                "readyForAliasEnable", snapshot.readyForAliasEnable(),
                "switches", Map.of(
                        "aliasEnabled", snapshot.aliasEnabled(),
                        "readEnabled", snapshot.readEnabled(),
                        "writeEnabled", snapshot.writeEnabled()
                ),
                "databaseUp", snapshot.databaseUp(),
                "checks", snapshot.checks(),
                "blockingReasons", snapshot.blockingReasons(),
                "timestamp", Instant.now().toString()
        );
        return ResponseEntity.ok(ApiResponse.ok("Revamp cutover readiness evaluated", payload));
    }
}
