package com.supplierplatform.contract;

import com.supplierplatform.revamp.dto.RevampReportKpisDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampReportService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampReportControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RevampReportService reportService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    @BeforeEach
    void setAuthentication() {
        User adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.report@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(AdminRole[].class)))
                .thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void kpisReturnsExpectedContract() throws Exception {
        when(reportService.getKpis()).thenReturn(new RevampReportKpisDto(100, 70, 12, 8, 5));

        mockMvc.perform(get("/api/v2/reports/kpis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalSuppliers").value(100))
                .andExpect(jsonPath("$.data.pendingInvites").value(5));
    }

    @Test
    void exportKpisReturnsCsvAttachment() throws Exception {
        byte[] csv = "metric,value\nactiveSuppliers,70\n".getBytes(StandardCharsets.UTF_8);
        when(reportService.exportKpisCsv()).thenReturn(csv);

        mockMvc.perform(get("/api/v2/reports/export").param("type", "kpis"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("attachment; filename=\"revamp_kpis_")))
                .andExpect(content().bytes(csv));
    }

}

