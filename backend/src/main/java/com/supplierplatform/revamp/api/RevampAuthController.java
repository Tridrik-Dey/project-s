package com.supplierplatform.revamp.api;

import com.supplierplatform.auth.AuthService;
import com.supplierplatform.auth.dto.AuthResponse;
import com.supplierplatform.auth.dto.AcceptInviteRequest;
import com.supplierplatform.auth.dto.LoginRequest;
import com.supplierplatform.auth.dto.RegisterRequest;
import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.ForgotPasswordRequestDto;
import com.supplierplatform.revamp.api.dto.ForgotPasswordResetDto;
import com.supplierplatform.revamp.api.dto.VerifyOtpChallengeRequest;
import com.supplierplatform.revamp.dto.OtpChallengeDispatchDto;
import com.supplierplatform.revamp.dto.OtpChallengeVerifyDto;
import com.supplierplatform.revamp.service.RevampOtpChallengeService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/auth")
@RequiredArgsConstructor
public class RevampAuthController {

    private final AuthService authService;
    private final RevampOtpChallengeService otpChallengeService;
    private final RevampAccessGuard revampAccessGuard;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.ok("Login successful", response));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(ApiResponse.ok("Registration successful", response));
    }

    @PostMapping("/accept-invite")
    public ResponseEntity<ApiResponse<AuthResponse>> acceptInvite(@Valid @RequestBody AcceptInviteRequest request) {
        AuthResponse response = authService.acceptInvite(request.getToken(), request.getPassword());
        return ResponseEntity.ok(ApiResponse.ok("Invite accepted successfully", response));
    }

    @PostMapping("/otp/send-email")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<OtpChallengeDispatchDto>> sendEmailOtp() {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        OtpChallengeDispatchDto dto = otpChallengeService.dispatchEmailVerificationOtp(currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Email OTP challenge dispatched", dto));
    }

    @PostMapping("/otp/verify-email")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<OtpChallengeVerifyDto>> verifyEmailOtp(
            @Valid @RequestBody VerifyOtpChallengeRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        OtpChallengeVerifyDto dto = otpChallengeService.verifyEmailChallenge(request.getChallengeId(), request.getOtpCode(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok("Email OTP challenge verified", dto));
    }

    @PostMapping("/forgot-password/request")
    public ResponseEntity<ApiResponse<OtpChallengeDispatchDto>> forgotPasswordRequest(
            @Valid @RequestBody ForgotPasswordRequestDto request) {
        OtpChallengeDispatchDto dto = otpChallengeService.dispatchPasswordResetOtp(request.getEmail());
        return ResponseEntity.ok(ApiResponse.ok("If the email exists, an OTP has been sent", dto));
    }

    @PostMapping("/forgot-password/reset")
    public ResponseEntity<ApiResponse<Void>> forgotPasswordReset(
            @Valid @RequestBody ForgotPasswordResetDto request) {
        otpChallengeService.verifyPasswordResetChallenge(request.getChallengeId(), request.getOtpCode(), request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.ok("Password reset successful", null));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
