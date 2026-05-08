package com.supplierplatform.validation;

import java.util.regex.Pattern;

public final class EmailValidators {
    private static final Pattern EMAIL_WITH_DOMAIN_SUFFIX =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private EmailValidators() {
    }

    public static String normalize(String email) {
        return email == null ? "" : email.trim();
    }

    public static boolean hasValidDomainSuffix(String email) {
        return EMAIL_WITH_DOMAIN_SUFFIX.matcher(normalize(email)).matches();
    }
}
