package com.supplierplatform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class RevampFeatureFlags {

    @Value("${app.features.revamp.new-wizard-ab:true}")
    private boolean newWizardAb;

    @Value("${app.features.revamp.admin-v2:true}")
    private boolean adminV2;

    @Value("${app.features.revamp.evaluation-v2:true}")
    private boolean evaluationV2;

    @Value("${app.features.revamp.renewal-v2:true}")
    private boolean renewalV2;

    @Value("${app.features.revamp.read-enabled:true}")
    private boolean readEnabled;

    @Value("${app.features.revamp.write-enabled:true}")
    private boolean writeEnabled;

    @Value("${app.features.revamp.alias-enabled:true}")
    private boolean aliasEnabled;

    public boolean isNewWizardAb() {
        return newWizardAb;
    }

    public boolean isAdminV2() {
        return adminV2;
    }

    public boolean isEvaluationV2() {
        return evaluationV2;
    }

    public boolean isRenewalV2() {
        return renewalV2;
    }

    public boolean isReadEnabled() {
        return readEnabled;
    }

    public boolean isWriteEnabled() {
        return writeEnabled;
    }

    public boolean isAliasEnabled() {
        return aliasEnabled;
    }
}
