package com.supplierplatform.revamp.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SaveApplicationSectionRequest {

    private String payloadJson;

    private Boolean completed;
}

