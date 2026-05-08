package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.auth.AuthService;
import com.supplierplatform.auth.dto.AcceptInviteRequest;
import com.supplierplatform.auth.dto.AuthResponse;
import com.supplierplatform.auth.dto.RegisterRequest;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class AuthControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @Test
    void registerReturnsApiResponseContract() throws Exception {
        UUID userId = UUID.randomUUID();
        AuthResponse response = AuthResponse.builder()
                .token("jwt-token")
                .userId(userId)
                .email("contract@test.com")
                .role(UserRole.SUPPLIER)
                .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(response);

        RegisterRequest request = new RegisterRequest();
        request.setEmail("contract@test.com");
        request.setPassword("Test@12345");


        mockMvc.perform(post("/api/v2/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Registration successful"))
                .andExpect(jsonPath("$.data.token").value("jwt-token"))
                .andExpect(jsonPath("$.data.userId").value(userId.toString()))
                .andExpect(jsonPath("$.data.email").value("contract@test.com"))
                .andExpect(jsonPath("$.data.role").value("SUPPLIER"));
    }

    @Test
    void revampAcceptInviteReturnsApiResponseContract() throws Exception {
        UUID userId = UUID.randomUUID();
        AuthResponse response = AuthResponse.builder()
                .token("jwt-token-admin")
                .userId(userId)
                .email("new.admin@test.com")
                .role(UserRole.ADMIN)
                .build();

        when(authService.acceptInvite("inv-token-1", "StrongPass@123")).thenReturn(response);

        AcceptInviteRequest request = new AcceptInviteRequest();
        request.setToken("inv-token-1");
        request.setPassword("StrongPass@123");

        mockMvc.perform(post("/api/v2/auth/accept-invite")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invite accepted successfully"))
                .andExpect(jsonPath("$.data.token").value("jwt-token-admin"))
                .andExpect(jsonPath("$.data.userId").value(userId.toString()))
                .andExpect(jsonPath("$.data.role").value("ADMIN"));
    }
}

