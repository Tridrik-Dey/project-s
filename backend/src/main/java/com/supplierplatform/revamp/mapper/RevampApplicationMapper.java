package com.supplierplatform.revamp.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import org.springframework.stereotype.Component;

@Component
public class RevampApplicationMapper {

    public RevampApplicationSummaryDto toSummary(RevampApplication application) {
        return new RevampApplicationSummaryDto(
                application.getId(),
                application.getApplicantUser() != null ? application.getApplicantUser().getId() : null,
                application.getRegistryType() != null ? application.getRegistryType().name() : null,
                application.getSourceChannel() != null ? application.getSourceChannel().name() : null,
                application.getStatus() != null ? application.getStatus().name() : null,
                application.getProtocolCode(),
                application.getCurrentRevision(),
                application.getSubmittedAt(),
                application.getUpdatedAt()
        );
    }

    public RevampSectionSnapshotDto toSectionSnapshot(RevampApplicationSection section) {
        return new RevampSectionSnapshotDto(
                section.getId(),
                section.getApplication() != null ? section.getApplication().getId() : null,
                section.getSectionKey(),
                section.getSectionVersion(),
                Boolean.TRUE.equals(section.getCompleted()),
                toJsonString(section.getPayloadJson()),
                section.getUpdatedAt()
        );
    }

    private String toJsonString(JsonNode node) {
        return node == null ? null : node.toString();
    }
}
