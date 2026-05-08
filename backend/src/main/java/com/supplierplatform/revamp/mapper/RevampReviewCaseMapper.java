package com.supplierplatform.revamp.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class RevampReviewCaseMapper {

    private RevampIntegrationRequestRepository integrationRequestRepository;
    private RevampApplicationSectionRepository sectionRepository;

    public RevampReviewCaseMapper() {
    }

    @Autowired
    public RevampReviewCaseMapper(RevampIntegrationRequestRepository integrationRequestRepository,
                                  RevampApplicationSectionRepository sectionRepository) {
        this.integrationRequestRepository = integrationRequestRepository;
        this.sectionRepository = sectionRepository;
    }

    public RevampReviewCaseSummaryDto toSummary(RevampReviewCase reviewCase) {
        RevampIntegrationRequest latestIntegrationRequest = reviewCase.getId() == null || integrationRequestRepository == null
                ? null
                : integrationRequestRepository.findFirstByReviewCaseIdOrderByCreatedAtDesc(reviewCase.getId());

        RevampApplication app = reviewCase.getApplication();
        String registryType = app != null && app.getRegistryType() != null ? app.getRegistryType().name() : null;
        String applicantDisplayName = app != null ? resolveDisplayName(app) : null;

        return new RevampReviewCaseSummaryDto(
                reviewCase.getId(),
                app != null ? app.getId() : null,
                app != null ? app.getProtocolCode() : null,
                reviewCase.getStatus() != null ? reviewCase.getStatus().name() : null,
                reviewCase.getDecision() != null ? reviewCase.getDecision().name() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getId() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getEmail() : null,
                reviewCase.getAssignedAt(),
                reviewCase.getSlaDueAt(),
                reviewCase.getVerifiedByUser() != null ? reviewCase.getVerifiedByUser().getId() : null,
                reviewCase.getVerifiedByUser() != null ? reviewCase.getVerifiedByUser().getEmail() : null,
                reviewCase.getVerifiedAt(),
                reviewCase.getVerificationNote(),
                reviewCase.getVerificationOutcome() != null ? reviewCase.getVerificationOutcome().name() : null,
                reviewCase.getDecidedByUser() != null ? reviewCase.getDecidedByUser().getId() : null,
                reviewCase.getDecidedByUser() != null ? reviewCase.getDecidedByUser().getEmail() : null,
                reviewCase.getDecidedAt(),
                latestIntegrationRequest != null && latestIntegrationRequest.getStatus() != null
                        ? latestIntegrationRequest.getStatus().name()
                        : null,
                latestIntegrationRequest != null ? latestIntegrationRequest.getSupplierRespondedAt() : null,
                reviewCase.getUpdatedAt(),
                registryType,
                applicantDisplayName
        );
    }

    private String resolveDisplayName(RevampApplication app) {
        if (sectionRepository == null) return null;
        return sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(app.getId(), "S1")
                .map(section -> extractName(app.getRegistryType(), section.getPayloadJson()))
                .orElse(null);
    }

    private String extractName(RegistryType registryType, JsonNode payload) {
        if (payload == null) return null;
        if (registryType == RegistryType.ALBO_B) {
            String company = payload.path("companyName").asText(null);
            if (company != null && !company.isBlank()) return company;
        }
        String first = payload.path("firstName").asText(null);
        String last  = payload.path("lastName").asText(null);
        String full  = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
        return full.isBlank() ? null : full;
    }
}
