package com.supplierplatform.category;

import com.supplierplatform.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class ServiceCategoryController {

    private final ServiceCategoryRepository serviceCategoryRepository;

    @GetMapping("/")
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getAllActiveCategories(
            @RequestParam(defaultValue = "en") String lang) {
        List<ServiceCategory> categories = serviceCategoryRepository.findByIsActiveTrue();
        List<CategoryResponse> response = categories.stream()
                .map(c -> toResponse(c, lang))
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/tree")
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getCategoryTree(
            @RequestParam(defaultValue = "en") String lang) {
        List<ServiceCategory> allActive = serviceCategoryRepository.findByIsActiveTrue();

        Map<UUID, List<ServiceCategory>> childrenByParentId = allActive.stream()
                .filter(c -> c.getParent() != null)
                .collect(Collectors.groupingBy(c -> c.getParent().getId()));

        List<CategoryResponse> topLevel = allActive.stream()
                .filter(c -> c.getParent() == null)
                .map(c -> toResponseWithChildren(c, childrenByParentId, lang))
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(topLevel));
    }

    private CategoryResponse toResponse(ServiceCategory category, String lang) {
        return CategoryResponse.builder()
                .id(category.getId())
                .code(category.getCode())
                .name(resolveLocalizedName(category, lang))
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .build();
    }

    private CategoryResponse toResponseWithChildren(
            ServiceCategory category,
            Map<UUID, List<ServiceCategory>> childrenByParentId,
            String lang) {
        List<CategoryResponse> children = childrenByParentId.getOrDefault(category.getId(), List.of())
                .stream()
                .map(child -> toResponseWithChildren(child, childrenByParentId, lang))
                .collect(Collectors.toList());

        return CategoryResponse.builder()
                .id(category.getId())
                .code(category.getCode())
                .name(resolveLocalizedName(category, lang))
                .parentId(category.getParent() != null ? category.getParent().getId() : null)
                .children(children.isEmpty() ? null : children)
                .build();
    }

    private String resolveLocalizedName(ServiceCategory category, String lang) {
        String normalizedLang = (lang == null ? "en" : lang.trim().toLowerCase(Locale.ROOT));
        if ("it".equals(normalizedLang)) {
            if (category.getNameIt() != null && !category.getNameIt().isBlank()) {
                return category.getNameIt();
            }
        } else {
            if (category.getNameEn() != null && !category.getNameEn().isBlank()) {
                return category.getNameEn();
            }
        }
        return category.getName();
    }
}
