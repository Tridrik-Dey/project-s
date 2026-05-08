package com.supplierplatform.support;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.support.dto.SupportContactRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportContactService supportContactService;

    @PostMapping("/contact")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitContact(@Valid @RequestBody SupportContactRequest request) {
        supportContactService.submit(request);
        return ResponseEntity.ok(ApiResponse.ok("Support request sent", Map.of("submitted", true)));
    }
}

