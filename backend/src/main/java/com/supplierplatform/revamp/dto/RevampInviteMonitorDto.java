package com.supplierplatform.revamp.dto;

import java.util.List;

public record RevampInviteMonitorDto(
        long totalInvites,
        long completedInvites,
        long pendingInvites,
        long expiredInvites,
        List<RevampInviteListRowDto> rows
) {
}

