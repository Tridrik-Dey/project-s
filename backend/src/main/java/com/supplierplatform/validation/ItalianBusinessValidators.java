package com.supplierplatform.validation;

import java.util.Locale;
import java.util.regex.Pattern;

public final class ItalianBusinessValidators {
    private static final Pattern ITALIAN_REGISTRATION_PATTERN = Pattern.compile("^(?:[A-Z]{2}[0-9]{6,8}|[0-9]{6,10})$");
    private static final Pattern ITALIAN_VAT_PATTERN = Pattern.compile("^[0-9]{11}$");
    private static final Pattern ITALIAN_TAX_ID_PATTERN = Pattern.compile("^(?:[A-Z0-9]{16}|[0-9]{11})$");

    private ItalianBusinessValidators() {
    }

    public static boolean isItalianBusiness(String country, String countryOfIncorporation) {
        return isItaly(country) || isItaly(countryOfIncorporation);
    }

    public static boolean isRegistrationNumberValid(String registrationNumber) {
        String normalized = normalize(registrationNumber).replace("-", "");
        return !normalized.isEmpty() && ITALIAN_REGISTRATION_PATTERN.matcher(normalized).matches();
    }

    public static boolean isTaxIdValid(String taxId) {
        String normalized = normalize(taxId).replace(" ", "");
        return !normalized.isEmpty() && ITALIAN_TAX_ID_PATTERN.matcher(normalized).matches();
    }

    public static boolean isVatNumberValid(String vatNumber) {
        String normalized = normalize(vatNumber);
        return !normalized.isEmpty() && ITALIAN_VAT_PATTERN.matcher(normalized).matches();
    }

    private static boolean isItaly(String value) {
        String normalized = normalize(value);
        return "ITALY".equals(normalized) || "ITALIA".equals(normalized);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
