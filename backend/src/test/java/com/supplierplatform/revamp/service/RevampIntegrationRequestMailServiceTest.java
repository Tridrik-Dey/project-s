package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import com.supplierplatform.user.User;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampIntegrationRequestMailServiceTest {

    @Mock
    private JavaMailSender javaMailSender;
    @Mock
    private RevampNotificationEventService notificationEventService;

    @InjectMocks
    private RevampIntegrationRequestMailService mailService;

    @Test
    void sendsNoticeToApplicantLoginEmailAndMarksNotificationSent() {
        ReflectionTestUtils.setField(mailService, "fromEmail", "no-reply@test.local");
        ReflectionTestUtils.setField(mailService, "frontendBaseUrl", "http://127.0.0.1:5173");

        RevampApplication application = new RevampApplication();
        application.setId(UUID.randomUUID());
        application.setProtocolCode("B-2026-5250");
        User applicant = new User();
        applicant.setEmail("supplier@test.com");
        application.setApplicantUser(applicant);

        RevampIntegrationRequest request = new RevampIntegrationRequest();
        request.setId(UUID.randomUUID());

        RevampNotificationEvent event = new RevampNotificationEvent();
        event.setId(UUID.randomUUID());
        when(notificationEventService.createPending(
                eq("revamp.integration_request.email"),
                eq("REVAMP_APPLICATION"),
                eq(application.getId()),
                eq("supplier@test.com"),
                isNull(),
                isNull(),
                any(String.class)
        )).thenReturn(event);
        when(javaMailSender.createMimeMessage()).thenReturn(new JavaMailSenderImpl().createMimeMessage());

        mailService.sendIntegrationRequestNotice(application, request);

        ArgumentCaptor<MimeMessage> messageCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(javaMailSender).send(messageCaptor.capture());
        verify(notificationEventService).markSent(event.getId(), null);
    }

    @Test
    void skipsNoticeWhenApplicantEmailIsMissing() {
        RevampApplication application = new RevampApplication();
        application.setId(UUID.randomUUID());
        application.setApplicantUser(new User());

        mailService.sendIntegrationRequestNotice(application, new RevampIntegrationRequest());

        verify(javaMailSender, never()).send(any(MimeMessage.class));
        verify(notificationEventService, never()).createPending(
                any(String.class),
                any(String.class),
                any(UUID.class),
                any(String.class),
                any(),
                any(),
                any(String.class)
        );
    }
}
