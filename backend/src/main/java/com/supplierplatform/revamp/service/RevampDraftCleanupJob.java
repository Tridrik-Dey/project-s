package com.supplierplatform.revamp.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RevampDraftCleanupJob {

    private final RevampApplicationService applicationService;

    @Value("${app.revamp.draft-cleanup.enabled:true}")
    private boolean enabled;

    @Value("${app.revamp.draft-cleanup.max-age-days:30}")
    private int maxAgeDays;

    @Scheduled(cron = "${app.revamp.draft-cleanup.cron:0 30 2 * * *}")
    public void deleteStaleDrafts() {
        if (!enabled) return;
        applicationService.deleteStaleDraftsOlderThanDays(maxAgeDays);
    }
}
