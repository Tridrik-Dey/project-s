package com.supplierplatform.validation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ItalianBusinessValidatorsTest {

    @Test
    void recognizesItalianBusinessFromCountryOrCountryOfIncorporation() {
        assertTrue(ItalianBusinessValidators.isItalianBusiness("Italy", null));
        assertTrue(ItalianBusinessValidators.isItalianBusiness(null, "italia"));
        assertFalse(ItalianBusinessValidators.isItalianBusiness("France", "Germany"));
    }

    @Test
    void validatesRegistrationNumberWithNormalization() {
        assertTrue(ItalianBusinessValidators.isRegistrationNumberValid("AB-123456"));
        assertTrue(ItalianBusinessValidators.isRegistrationNumberValid("1234567890"));
        assertFalse(ItalianBusinessValidators.isRegistrationNumberValid("A123"));
    }

    @Test
    void acceptsItalianTaxIdAs16AlphanumericOr11Digits() {
        assertTrue(ItalianBusinessValidators.isTaxIdValid("RSSMRA85T10A562S"));
        assertTrue(ItalianBusinessValidators.isTaxIdValid("12345678901"));
        assertFalse(ItalianBusinessValidators.isTaxIdValid("12345"));
    }

    @Test
    void validatesVatAsExactlyElevenDigits() {
        assertTrue(ItalianBusinessValidators.isVatNumberValid("12345678901"));
        assertFalse(ItalianBusinessValidators.isVatNumberValid("1234567890"));
        assertFalse(ItalianBusinessValidators.isVatNumberValid("ABCDEFGHIJK"));
    }
}

