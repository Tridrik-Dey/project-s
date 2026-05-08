package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.search.dto.AdvancedSearchRequest;
import com.supplierplatform.search.dto.SearchResultRowResponse;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/search")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampSearchController {

    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping("/suppliers")
    public ResponseEntity<ApiResponse<Page<SearchResultRowResponse>>> searchSuppliers(
            @RequestParam(name = "q") String q,
            @RequestParam(name = "fields") List<String> fields,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        Page<SearchResultRowResponse> empty = new PageImpl<>(List.of(), PageRequest.of(page, size), 0);
        return ResponseEntity.ok(ApiResponse.ok(empty));
    }

    @PostMapping("/advanced")
    public ResponseEntity<ApiResponse<Page<SearchResultRowResponse>>> advancedSearch(
            @Valid @RequestBody AdvancedSearchRequest request
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 20;
        Page<SearchResultRowResponse> empty = new PageImpl<>(List.of(), PageRequest.of(page, size), 0);
        return ResponseEntity.ok(ApiResponse.ok(empty));
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user.getId();
        }
        return null;
    }
}
