package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.model.RevampInvite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampInviteRepository extends JpaRepository<RevampInvite, UUID> {
    Optional<RevampInvite> findByToken(String token);
    List<RevampInvite> findByInvitedEmailIgnoreCase(String invitedEmail);
    List<RevampInvite> findByStatusAndExpiresAtBefore(InviteStatus status, LocalDateTime expiresAt);
    List<RevampInvite> findByStatusInAndExpiresAtBefore(List<InviteStatus> statuses, LocalDateTime expiresAt);
    List<RevampInvite> findByStatusInAndExpiresAtBetween(List<InviteStatus> statuses, LocalDateTime startsAt, LocalDateTime endsAt);
    List<RevampInvite> findAllByOrderByCreatedAtDesc();
}
