package com.supplierplatform.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailValidatorsTest {

    @Test
    void normalizesByTrimmingOrReturningEmptyString() {
        assertEquals("user@example.com", EmailValidators.normalize("  user@example.com  "));
        assertEquals("", EmailValidators.normalize(null));
    }

    @Test
    void validatesEmailDomainSuffixPattern() {
        assertTrue(EmailValidators.hasValidDomainSuffix("user@example.com"));
        assertTrue(EmailValidators.hasValidDomainSuffix(" user@example.it "));
        assertFalse(EmailValidators.hasValidDomainSuffix("user@example"));
        assertFalse(EmailValidators.hasValidDomainSuffix("user@"));
    }
}

