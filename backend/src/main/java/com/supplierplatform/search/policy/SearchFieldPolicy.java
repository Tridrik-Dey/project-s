package com.supplierplatform.search.policy;

import com.supplierplatform.user.UserRole;

import java.util.Set;

public record SearchFieldPolicy(
        String fieldKey,
        String tableName,
        String columnName,
        String label,
        SearchDataType dataType,
        SearchMatchMode matchMode,
        Set<UserRole> allowedRoles,
        boolean exportable
) {
}
