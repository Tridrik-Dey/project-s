package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.enums.RegistryType;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class RevampProtocolCodeService {

    public String nextProtocolCode(RegistryType registryType) {
        String prefix = registryType == RegistryType.ALBO_A ? "A" : "B";
        int year = LocalDate.now().getYear();
        int suffix = ThreadLocalRandom.current().nextInt(1000, 9999);
        return prefix + "-" + year + "-" + suffix;
    }
}

