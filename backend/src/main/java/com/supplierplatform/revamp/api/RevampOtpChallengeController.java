package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.SendOtpChallengeRequest;
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
@RequestMapping("/api/v2/otp-challenges")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class RevampOtpChallengeController {

    private final RevampOtpChallengeService otpChallengeService;
    private final RevampAccessGuard revampAccessGuard;

    @PostMapping("/declaration/send")
    public ResponseEntity<ApiResponse<OtpChallengeDispatchDto>> sendDeclarationOtp(
            @Valid @RequestBody SendOtpChallengeRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        OtpChallengeDispatchDto dto = otpChallengeService.dispatchDeclarationSignatureOtp(request.getApplicationId(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok("OTP challenge dispatched", dto));
    }

    @PostMapping("/declaration/verify")
    public ResponseEntity<ApiResponse<OtpChallengeVerifyDto>> verifyDeclarationOtp(
            @Valid @RequestBody VerifyOtpChallengeRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        OtpChallengeVerifyDto dto = otpChallengeService.verifyChallenge(request.getChallengeId(), request.getOtpCode(), currentUser);
        return ResponseEntity.ok(ApiResponse.ok("OTP challenge verified", dto));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
