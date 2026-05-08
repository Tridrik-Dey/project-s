package com.supplierplatform.validation;

import org.springframework.stereotype.Service;

import javax.naming.NamingException;
import javax.naming.directory.InitialDirContext;
import java.net.IDN;
import java.util.Hashtable;

@Service
public class EmailDeliverabilityValidator {

    public boolean hasReceivableDomain(String email) {
        String normalized = EmailValidators.normalize(email).toLowerCase();
        int at = normalized.lastIndexOf('@');
        if (at <= 0 || at >= normalized.length() - 1) {
            return false;
        }
        String domain = normalized.substring(at + 1);
        if (!EmailValidators.hasValidDomainSuffix(normalized)) {
            return false;
        }
        return hasDnsRecord(domain, "MX") || hasDnsRecord(domain, "A") || hasDnsRecord(domain, "AAAA");
    }

    private boolean hasDnsRecord(String domain, String recordType) {
        try {
            String asciiDomain = IDN.toASCII(domain);
            Hashtable<String, String> env = new Hashtable<>();
            env.put("java.naming.factory.initial", "com.sun.jndi.dns.DnsContextFactory");
            var context = new InitialDirContext(env);
            var attributes = context.getAttributes(asciiDomain, new String[] { recordType });
            var records = attributes.get(recordType);
            return records != null && records.size() > 0;
        } catch (IllegalArgumentException | NamingException ex) {
            return false;
        }
    }
}
