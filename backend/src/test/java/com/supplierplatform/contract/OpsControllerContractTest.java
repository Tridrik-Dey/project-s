package com.supplierplatform.contract;

import com.supplierplatform.ops.OpsHealthService;
import com.supplierplatform.ops.OpsRevampCutoverReadinessService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class OpsControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OpsHealthService opsHealthService;

    @MockBean
    private OpsRevampCutoverReadinessService opsRevampCutoverReadinessService;

    @Test
    void healthEndpointReturnsExpectedContract() throws Exception {
        when(opsHealthService.getHealthSnapshot())
                .thenReturn(new OpsHealthService.HealthSnapshot("UP", true, true));

        mockMvc.perform(get("/api/ops/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Health check completed"))
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.databaseUp").value(true))
                .andExpect(jsonPath("$.data.mailConfigValid").value(true))
                .andExpect(jsonPath("$.data.timestamp").exists());
    }

    @Test
    void revampCutoverReadinessEndpointReturnsExpectedContract() throws Exception {
        when(opsRevampCutoverReadinessService.evaluate())
                .thenReturn(new OpsRevampCutoverReadinessService.CutoverSnapshot(
                        "READY",
                        true,
                        false,
                        true,
                        true,
                        true,
                        java.util.List.of(
                                new OpsRevampCutoverReadinessService.CheckResult(
                                        "final_tables_exist",
                                        true,
                                        "12",
                                        "Expected 12 final tables"
                                )
                        ),
                        java.util.List.of()
                ));

        mockMvc.perform(get("/api/ops/revamp-cutover-readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Revamp cutover readiness evaluated"))
                .andExpect(jsonPath("$.data.status").value("READY"))
                .andExpect(jsonPath("$.data.readyForAliasEnable").value(true))
                .andExpect(jsonPath("$.data.switches.aliasEnabled").value(false))
                .andExpect(jsonPath("$.data.switches.readEnabled").value(true))
                .andExpect(jsonPath("$.data.switches.writeEnabled").value(true))
                .andExpect(jsonPath("$.data.databaseUp").value(true))
                .andExpect(jsonPath("$.data.checks[0].name").value("final_tables_exist"))
                .andExpect(jsonPath("$.data.checks[0].passed").value(true))
                .andExpect(jsonPath("$.data.timestamp").exists());
    }
}

