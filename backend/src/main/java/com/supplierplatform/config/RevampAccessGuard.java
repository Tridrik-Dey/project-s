package com.supplierplatform.config;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Component
@RequiredArgsConstructor
public class RevampAccessGuard {

    private final RevampFeatureFlags featureFlags;

    public void requireReadEnabled() {
        requireAliasEnabledWhenAliasRoute();
        if (!featureFlags.isReadEnabled()) {
            throw new IllegalStateException("Revamp read path is disabled");
        }
    }

    public void requireWriteEnabled() {
        requireAliasEnabledWhenAliasRoute();
        if (!featureFlags.isWriteEnabled()) {
            throw new IllegalStateException("Revamp write path is disabled");
        }
    }

    private void requireAliasEnabledWhenAliasRoute() {
        String uri = currentRequestUri();
        if (uri != null && uri.startsWith("/api/") && !uri.startsWith("/api/v2/") && !featureFlags.isAliasEnabled()) {
            throw new IllegalStateException("Revamp alias bridge is disabled");
        }
    }

    private String currentRequestUri() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return null;
        }
        return attrs.getRequest().getRequestURI();
    }
}
