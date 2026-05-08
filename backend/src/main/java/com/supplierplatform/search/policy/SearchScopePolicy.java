package com.supplierplatform.search.policy;

import com.supplierplatform.user.UserRole;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class SearchScopePolicy {

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MAX_PAGE_SIZE = 200;
    public static final int MAX_SELECTED_FIELDS = 20;
    public static final int MAX_SEARCH_TERM_LENGTH = 100;
    public static final int MAX_EXPORT_ROWS = 50_000;

    private static final Set<UserRole> ADMIN_ONLY = Set.of(UserRole.ADMIN);

    private static final List<SearchFieldPolicy> ALLOWED_FIELDS = List.of(
            new SearchFieldPolicy(
                    "supplier.companyName",
                    "supplier_profiles",
                    "company_name",
                    "Company Name",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.tradingName",
                    "supplier_profiles",
                    "trading_name",
                    "Trading Name",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.companyType",
                    "supplier_profiles",
                    "company_type",
                    "Company Type",
                    SearchDataType.ENUM,
                    SearchMatchMode.EXACT,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.vatNumber",
                    "supplier_profiles",
                    "vat_number",
                    "VAT Number",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.taxId",
                    "supplier_profiles",
                    "tax_id",
                    "Tax ID",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.registrationNumber",
                    "supplier_profiles",
                    "registration_number",
                    "Registration Number",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.countryOfIncorporation",
                    "supplier_profiles",
                    "country_of_incorporation",
                    "Country of Incorporation",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.incorporationDate",
                    "supplier_profiles",
                    "incorporation_date",
                    "Incorporation Date",
                    SearchDataType.DATE,
                    SearchMatchMode.EXACT,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.employeeCountRange",
                    "supplier_profiles",
                    "employee_count_range",
                    "Employee Count",
                    SearchDataType.ENUM,
                    SearchMatchMode.EXACT,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.annualRevenueRange",
                    "supplier_profiles",
                    "annual_revenue_range",
                    "Annual Revenue",
                    SearchDataType.ENUM,
                    SearchMatchMode.EXACT,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.city",
                    "supplier_profiles",
                    "city",
                    "City",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.stateProvince",
                    "supplier_profiles",
                    "state_province",
                    "State/Province",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.postalCode",
                    "supplier_profiles",
                    "postal_code",
                    "Postal Code",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.description",
                    "supplier_profiles",
                    "description",
                    "Description",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.status",
                    "supplier_profiles",
                    "status",
                    "Supplier Status",
                    SearchDataType.ENUM,
                    SearchMatchMode.EXACT,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "supplier.country",
                    "supplier_profiles",
                    "country",
                    "Country",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "user.email",
                    "users",
                    "email",
                    "User Email",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            ),
            new SearchFieldPolicy(
                    "user.fullName",
                    "users",
                    "email",
                    "User Email",
                    SearchDataType.TEXT,
                    SearchMatchMode.CONTAINS,
                    ADMIN_ONLY,
                    true
            )
    );

    public List<SearchFieldPolicy> getAllowedFields() {
        return ALLOWED_FIELDS;
    }

    public List<SearchFieldPolicy> getAllowedFields(UserRole role) {
        return ALLOWED_FIELDS.stream()
                .filter(field -> field.allowedRoles().contains(role))
                .toList();
    }

    public List<SearchFieldPolicy> resolveFields(UserRole role, List<String> selectedFieldKeys) {
        List<SearchFieldPolicy> allowedForRole = getAllowedFields(role);
        Set<String> allowedKeys = allowedForRole.stream()
                .map(SearchFieldPolicy::fieldKey)
                .collect(java.util.stream.Collectors.toSet());

        Set<String> requested = new HashSet<>(selectedFieldKeys);
        if (!allowedKeys.containsAll(requested)) {
            throw new IllegalArgumentException("One or more selected fields are not allowed");
        }

        return allowedForRole.stream()
                .filter(field -> requested.contains(field.fieldKey()))
                .toList();
    }
}
