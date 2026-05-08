package com.supplierplatform.user;

import com.supplierplatform.auth.dto.RegisterRequest;
import com.supplierplatform.common.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new EntityNotFoundException("User", email));
    }

    public User findById(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));
    }

    @Transactional
    public User createSupplierUser(RegisterRequest request) {
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(UserRole.SUPPLIER);
        user.setIsActive(true);
        return userRepository.save(user);
    }

    @Transactional
    public User createInvitedUser(String email, UUID invitedByUserId, LocalDateTime inviteExpiresAt) {
        User invitedBy = findById(invitedByUserId);
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setRole(UserRole.ADMIN);
        user.setIsActive(false);
        user.setInvitedBy(invitedBy);
        user.setInviteToken(UUID.randomUUID().toString());
        user.setInviteExpiresAt(inviteExpiresAt);
        return userRepository.save(user);
    }

    @Transactional
    public void updateLastLogin(UUID userId) {
        User user = findById(userId);
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);
    }
}
