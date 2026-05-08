package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAggregateDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampEvaluationHistoryItemDto;
import com.supplierplatform.revamp.dto.RevampEvaluationOverviewDto;
import com.supplierplatform.revamp.dto.RevampEvaluationOverviewRowDto;
import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.mapper.RevampEvaluationMapper;
import com.supplierplatform.revamp.model.RevampEvaluation;
import com.supplierplatform.revamp.model.RevampEvaluationDimension;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampEvaluationDimensionRepository;
import com.supplierplatform.revamp.repository.RevampEvaluationRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class RevampEvaluationService {

    private final RevampEvaluationRepository evaluationRepository;
    private final RevampEvaluationDimensionRepository evaluationDimensionRepository;
    private final RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    private final UserRepository userRepository;
    private final RevampEvaluationMapper evaluationMapper;
    private final RevampEvaluationAssignmentService evaluationAssignmentService;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;
    private final RevampAuditService auditService;

    @Transactional
    public RevampEvaluationSummaryDto upsertEvaluation(
            UUID supplierRegistryProfileId,
            UUID viewerUserId,
            String collaborationType,
            String collaborationPeriod,
            String referenceCode,
            short overallScore,
            String comment,
            Map<String, Short> dimensions
    ) {
        governanceAuthorizationService.requireAnyRole(viewerUserId, AdminRole.VIEWER);
        evaluationAssignmentService.requireAssignedViewer(supplierRegistryProfileId, viewerUserId);

        RevampSupplierRegistryProfile profile = supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));
        User evaluator = userRepository.findById(viewerUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", viewerUserId));

        RevampEvaluation evaluation = evaluationRepository
                .findBySupplierRegistryProfileIdAndEvaluatorUserId(supplierRegistryProfileId, viewerUserId)
                .orElseGet(RevampEvaluation::new);

        boolean isNew = evaluation.getId() == null;
        evaluation.setSupplierRegistryProfile(profile);
        evaluation.setEvaluatorUser(evaluator);
        evaluation.setCollaborationType(collaborationType);
        evaluation.setCollaborationPeriod(collaborationPeriod);
        evaluation.setReferenceCode(referenceCode);
        evaluation.setOverallScore(overallScore);
        evaluation.setComment(comment);
        evaluation.setCreatedAt(LocalDateTime.now());

        RevampEvaluation saved = evaluationRepository.save(evaluation);

        if (!isNew) {
            evaluationDimensionRepository.deleteByEvaluationId(saved.getId());
        }

        if (dimensions != null && !dimensions.isEmpty()) {
            for (Map.Entry<String, Short> entry : dimensions.entrySet()) {
                if (entry.getValue() == null || entry.getValue() < 1 || entry.getValue() > 5) {
                    throw new IllegalArgumentException("Dimension scores must be between 1 and 5");
                }
                RevampEvaluationDimension dimension = new RevampEvaluationDimension();
                dimension.setEvaluation(saved);
                dimension.setDimensionKey(entry.getKey());
                dimension.setScore(entry.getValue());
                evaluationDimensionRepository.save(dimension);
            }
        }

        appendEvaluationAudit(isNew ? "revamp.evaluation.created" : "revamp.evaluation.updated", saved, viewerUserId);
        return evaluationMapper.toSummary(saved);
    }

    @Transactional
    public void deleteEvaluation(UUID evaluationId, UUID actorUserId) {
        governanceAuthorizationService.requireAnyRole(actorUserId, AdminRole.SUPER_ADMIN);
        RevampEvaluation evaluation = evaluationRepository.findById(evaluationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampEvaluation", evaluationId));
        evaluationDimensionRepository.deleteByEvaluationId(evaluationId);
        evaluationRepository.delete(evaluation);
        appendEvaluationAudit("revamp.evaluation.deleted", evaluation, actorUserId);
    }

    @Transactional(readOnly = true)
    public List<RevampEvaluationSummaryDto> listBySupplier(UUID supplierRegistryProfileId) {
        return evaluationRepository.findBySupplierRegistryProfileIdOrderByCreatedAtDesc(supplierRegistryProfileId).stream()
                .map(evaluationMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampEvaluationAggregateDto getAggregateForSupplierUser(UUID supplierUserId) {
        List<RevampSupplierRegistryProfile> profiles = supplierRegistryProfileRepository.findBySupplierUserId(supplierUserId);
        if (profiles.isEmpty()) {
            return new RevampEvaluationAggregateDto(null, 0, 0, 0.0);
        }
        RevampSupplierRegistryProfile profile = profiles.stream()
                .max(Comparator.comparing(p -> p.getCreatedAt() != null ? p.getCreatedAt() : java.time.LocalDateTime.MIN))
                .get();

        List<UUID> profileIds = profiles.stream()
                .map(RevampSupplierRegistryProfile::getId)
                .filter(Objects::nonNull)
                .toList();
        List<RevampEvaluation> evals = evaluationRepository
                .findBySupplierRegistryProfileIdInOrderByCreatedAtDesc(profileIds);

        long active = evals.size();
        double avg = evals.stream()
                .mapToInt(e -> e.getOverallScore() != null ? e.getOverallScore() : 0)
                .average()
                .orElse(0.0);
        Map<Integer, Long> scoreDistribution = scoreDistribution(evals);
        Map<String, Double> dimensionAverages = dimensionAverages(evals);

        return new RevampEvaluationAggregateDto(
                profile.getId(),
                evals.size(),
                active,
                Math.round(avg * 100.0) / 100.0,
                dimensionAverages,
                scoreDistribution
        );
    }

    @Transactional(readOnly = true)
    public RevampEvaluationAggregateDto summaryBySupplier(UUID supplierRegistryProfileId) {
        List<RevampEvaluation> evaluations = evaluationRepository
                .findBySupplierRegistryProfileIdOrderByCreatedAtDesc(supplierRegistryProfileId);
        long total = evaluations.size();
        double average = evaluations.stream()
                .mapToInt(e -> e.getOverallScore() != null ? e.getOverallScore() : 0)
                .average()
                .orElse(0.0);
        Map<Integer, Long> scoreDistribution = scoreDistribution(evaluations);
        Map<String, Double> dimensionAverages = dimensionAverages(evaluations);

        return new RevampEvaluationAggregateDto(
                supplierRegistryProfileId,
                total,
                total,
                Math.round(average * 100.0) / 100.0,
                dimensionAverages,
                scoreDistribution
        );
    }

    @Transactional(readOnly = true)
    public RevampEvaluationOverviewDto overview(
            String query,
            String type,
            String period,
            Double minScore,
            String evaluator,
            int limit
    ) {
        List<RevampEvaluation> all = evaluationRepository.findAllByOrderByCreatedAtDesc();

        Map<UUID, List<RevampEvaluationDimension>> dimensionsByEvaluationId = loadDimensions(all);
        List<RevampEvaluationOverviewRowDto> evaluationRows = all.stream()
                .filter(e -> e.getSupplierRegistryProfile() != null && e.getSupplierRegistryProfile().getId() != null)
                .collect(Collectors.groupingBy(
                        e -> e.getSupplierRegistryProfile().getId(),
                        java.util.LinkedHashMap::new,
                        Collectors.toList()
                ))
                .values()
                .stream()
                .map(evaluations -> toAggregateOverviewRow(evaluations, dimensionsByEvaluationId))
                .toList();
        Map<UUID, Boolean> hasEvaluationBySupplierId = evaluationRows.stream()
                .filter(row -> row.supplierRegistryProfileId() != null)
                .collect(Collectors.toMap(
                        RevampEvaluationOverviewRowDto::supplierRegistryProfileId,
                        ignored -> true,
                        (a, b) -> true
                ));
        List<RevampEvaluationOverviewRowDto> supplierRows = supplierRegistryProfileRepository.findByStatus(RegistryProfileStatus.APPROVED).stream()
                .filter(profile -> profile.getId() != null && !hasEvaluationBySupplierId.containsKey(profile.getId()))
                .map(this::toUnevaluatedOverviewRow)
                .toList();
        List<RevampEvaluationOverviewRowDto> rows = java.util.stream.Stream.concat(evaluationRows.stream(), supplierRows.stream())
                .filter(row -> filterRow(row, query, type, period, minScore, evaluator))
                .sorted(Comparator.comparing(RevampEvaluationOverviewRowDto::createdAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(1, Math.min(500, limit)))
                .toList();

        LocalDate firstDayOfMonth = LocalDate.now().withDayOfMonth(1);
        long currentMonthEvaluations = all.stream()
                .filter(e -> e.getCreatedAt() != null && !e.getCreatedAt().toLocalDate().isBefore(firstDayOfMonth))
                .count();
        long evaluatedSuppliers = all.stream()
                .map(e -> e.getSupplierRegistryProfile() != null ? e.getSupplierRegistryProfile().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .count();
        double average = all.stream()
                .mapToDouble(e -> e.getOverallScore() != null ? e.getOverallScore() : 0.0)
                .average()
                .orElse(0.0);

        return new RevampEvaluationOverviewDto(
                all.size(),
                Math.round(average * 100.0) / 100.0,
                currentMonthEvaluations,
                evaluatedSuppliers,
                rows
        );
    }

    @Transactional(readOnly = true)
    public RevampEvaluationAnalyticsDto analyticsBySupplier(UUID supplierRegistryProfileId) {
        RevampSupplierRegistryProfile supplier = supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));

        List<RevampEvaluation> evaluations = evaluationRepository
                .findBySupplierRegistryProfileIdOrderByCreatedAtDesc(supplierRegistryProfileId);

        Map<UUID, List<RevampEvaluationDimension>> dimensionsByEvaluationId = loadDimensions(evaluations);
        List<RevampEvaluationHistoryItemDto> history = new ArrayList<>();
        Map<String, List<Double>> dimensionScoreAccumulator = new java.util.LinkedHashMap<>();
        Map<Integer, Long> distribution = new java.util.LinkedHashMap<>();
        for (int score = 5; score >= 1; score -= 1) {
            distribution.put(score, 0L);
        }

        for (RevampEvaluation evaluation : evaluations) {
            List<RevampEvaluationDimension> dims = dimensionsByEvaluationId.getOrDefault(evaluation.getId(), List.of());
            Map<String, Double> dimensionScores = dims.stream()
                    .collect(Collectors.toMap(
                            d -> normalizeDimensionKey(d.getDimensionKey()),
                            d -> round2(d.getScore() != null ? d.getScore() : 0.0),
                            (a, b) -> b,
                            java.util.LinkedHashMap::new
                    ));

            dimensionScores.forEach((key, value) ->
                    dimensionScoreAccumulator.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value));

            int scoreBucket = evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0;
            if (distribution.containsKey(scoreBucket)) {
                distribution.put(scoreBucket, distribution.get(scoreBucket) + 1);
            }

            history.add(new RevampEvaluationHistoryItemDto(
                    evaluation.getId(),
                    evaluation.getCreatedAt(),
                    evaluation.getCollaborationType(),
                    evaluation.getCollaborationPeriod(),
                    evaluation.getReferenceCode(),
                    evaluation.getComment(),
                    round2(calculateAverageScore(evaluation, dims)),
                    dimensionScores,
                    anonymizeEvaluator(evaluation.getEvaluatorUser() != null ? evaluation.getEvaluatorUser().getEmail() : null)
            ));
        }

        Map<String, Double> dimensionAverages = dimensionScoreAccumulator.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> round2(e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)),
                        (a, b) -> b,
                        java.util.LinkedHashMap::new
                ));

        double overallAverage = evaluations.stream()
                .mapToDouble(e -> e.getOverallScore() != null ? e.getOverallScore() : 0.0)
                .average()
                .orElse(0.0);

        return new RevampEvaluationAnalyticsDto(
                supplierRegistryProfileId,
                supplier.getDisplayName(),
                supplier.getRegistryType() != null ? supplier.getRegistryType().name() : null,
                evaluations.size(),
                round2(overallAverage),
                dimensionAverages,
                distribution,
                history
        );
    }

    private Map<UUID, List<RevampEvaluationDimension>> loadDimensions(List<RevampEvaluation> evaluations) {
        List<UUID> evaluationIds = evaluations.stream().map(RevampEvaluation::getId).filter(Objects::nonNull).toList();
        if (evaluationIds.isEmpty()) {
            return Map.of();
        }
        return evaluationDimensionRepository.findByEvaluationIdIn(evaluationIds).stream()
                .filter(d -> d.getEvaluation() != null && d.getEvaluation().getId() != null)
                .collect(Collectors.groupingBy(
                        d -> d.getEvaluation().getId(),
                        Collectors.mapping(Function.identity(), Collectors.toList())
                ));
    }

    private Map<String, Double> dimensionAverages(List<RevampEvaluation> evaluations) {
        Map<UUID, List<RevampEvaluationDimension>> dimensionsByEvaluationId = loadDimensions(evaluations);
        Map<String, List<Double>> accumulator = new java.util.LinkedHashMap<>();
        evaluations.forEach(evaluation ->
                dimensionsByEvaluationId.getOrDefault(evaluation.getId(), List.of()).forEach(dimension -> {
                    String key = normalizeDimensionKey(dimension.getDimensionKey());
                    double value = dimension.getScore() != null ? dimension.getScore() : 0.0;
                    accumulator.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                })
        );
        return accumulator.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> round2(e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)),
                        (a, b) -> b,
                        java.util.LinkedHashMap::new
                ));
    }

    private RevampEvaluationOverviewRowDto toAggregateOverviewRow(
            List<RevampEvaluation> evaluations,
            Map<UUID, List<RevampEvaluationDimension>> dimensionsByEvaluationId
    ) {
        RevampEvaluation latest = evaluations.stream()
                .max(Comparator.comparing(RevampEvaluation::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElseThrow();
        Map<String, List<Double>> dimensionScoreAccumulator = new java.util.LinkedHashMap<>();
        evaluations.forEach(evaluation ->
                dimensionsByEvaluationId.getOrDefault(evaluation.getId(), List.of()).forEach(dimension -> {
                    String key = normalizeDimensionKey(dimension.getDimensionKey());
                    double value = dimension.getScore() != null ? dimension.getScore() : 0.0;
                    dimensionScoreAccumulator.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                })
        );
        Map<String, Double> dimensionScores = dimensionScoreAccumulator.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> round2(e.getValue().stream().mapToDouble(Double::doubleValue).average().orElse(0.0)),
                        (a, b) -> b,
                        java.util.LinkedHashMap::new
                ));

        String supplierType = latest.getSupplierRegistryProfile() != null && latest.getSupplierRegistryProfile().getRegistryType() != null
                ? latest.getSupplierRegistryProfile().getRegistryType().name()
                : null;
        String protocolCode = protocolCode(latest.getSupplierRegistryProfile());
        List<String> evaluatorEmails = evaluations.stream()
                .map(e -> e.getEvaluatorUser() != null ? e.getEvaluatorUser().getEmail() : null)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        String evaluatorDisplay = evaluatorEmails.size() == 1
                ? evaluatorEmails.get(0)
                : evaluatorEmails.size() + " valutatori";
        double averageScore = evaluations.stream()
                .mapToDouble(e -> calculateAverageScore(e, dimensionsByEvaluationId.getOrDefault(e.getId(), List.of())))
                .average()
                .orElse(0.0);

        return new RevampEvaluationOverviewRowDto(
                latest.getId(),
                latest.getSupplierRegistryProfile() != null ? latest.getSupplierRegistryProfile().getId() : null,
                latest.getSupplierRegistryProfile() != null ? latest.getSupplierRegistryProfile().getDisplayName() : null,
                supplierType,
                protocolCode,
                latest.getCreatedAt(),
                latest.getCollaborationType(),
                latest.getCollaborationPeriod(),
                latest.getReferenceCode(),
                latest.getComment(),
                evaluatorDisplay,
                round2(averageScore),
                evaluations.size(),
                dimensionScores
        );
    }

    private RevampEvaluationOverviewRowDto toUnevaluatedOverviewRow(RevampSupplierRegistryProfile profile) {
        return new RevampEvaluationOverviewRowDto(
                null,
                profile.getId(),
                profile.getDisplayName() != null ? profile.getDisplayName() : (profile.getSupplierUser() != null ? profile.getSupplierUser().getEmail() : null),
                profile.getRegistryType() != null ? profile.getRegistryType().name() : null,
                protocolCode(profile),
                profile.getUpdatedAt() != null ? profile.getUpdatedAt() : profile.getCreatedAt(),
                null,
                null,
                null,
                null,
                null,
                0.0,
                0L,
                Map.of()
        );
    }

    private boolean filterRow(RevampEvaluationOverviewRowDto row, String query, String type, String period, Double minScore, String evaluator) {
        if (query != null && !query.isBlank()) {
            String q = query.toLowerCase(Locale.ROOT).trim();
            String haystack = String.join(" ",
                    row.supplierName() != null ? row.supplierName() : "",
                    row.comment() != null ? row.comment() : "",
                    row.referenceCode() != null ? row.referenceCode() : "",
                    row.protocolCode() != null ? row.protocolCode() : ""
            ).toLowerCase(Locale.ROOT);
            if (!haystack.contains(q)) return false;
        }
        if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type)) {
            if (!type.toUpperCase(Locale.ROOT).equalsIgnoreCase(row.supplierType())) return false;
        }
        if (period != null && !period.isBlank()) {
            if (row.collaborationPeriod() == null || !row.collaborationPeriod().toLowerCase(Locale.ROOT).contains(period.toLowerCase(Locale.ROOT))) return false;
        }
        if (minScore != null && row.averageScore() < minScore) return false;
        if (evaluator != null && !evaluator.isBlank() && !"ALL".equalsIgnoreCase(evaluator)) {
            String display = row.evaluatorDisplay() != null ? row.evaluatorDisplay().toLowerCase(Locale.ROOT) : "";
            if (!display.contains(evaluator.toLowerCase(Locale.ROOT))) return false;
        }
        return true;
    }

    private String protocolCode(RevampSupplierRegistryProfile profile) {
        if (profile == null || profile.getApplication() == null) {
            return null;
        }
        return profile.getApplication().getProtocolCode();
    }

    private double calculateAverageScore(RevampEvaluation evaluation, List<RevampEvaluationDimension> dimensions) {
        if (dimensions == null || dimensions.isEmpty()) {
            return evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0.0;
        }
        return dimensions.stream()
                .mapToDouble(d -> d.getScore() != null ? d.getScore() : 0.0)
                .average()
                .orElse(evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0.0);
    }

    private Map<Integer, Long> scoreDistribution(List<RevampEvaluation> evaluations) {
        Map<Integer, Long> distribution = new java.util.LinkedHashMap<>();
        for (int score = 1; score <= 5; score++) {
            final int s = score;
            long count = evaluations.stream()
                    .filter(e -> e.getOverallScore() != null && e.getOverallScore() == s)
                    .count();
            distribution.put(score, count);
        }
        return distribution;
    }

    private Map<Integer, Long> scoreDistributionFromSummaries(List<RevampEvaluationSummaryDto> evaluations) {
        Map<Integer, Long> distribution = new java.util.LinkedHashMap<>();
        for (int score = 1; score <= 5; score++) {
            final int s = score;
            long count = evaluations.stream().filter(e -> e.overallScore() == s).count();
            distribution.put(score, count);
        }
        return distribution;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String normalizeDimensionKey(String key) {
        if (key == null || key.isBlank()) return "Altro";
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "quality", "qualita", "qualita_tecnica", "technical_quality" -> "Qualita tecnica";
            case "timeliness", "rispetto_tempi", "delivery_time", "tempi" -> "Rispetto tempi";
            case "communication", "comunicazione" -> "Comunicazione";
            case "flexibility", "flessibilita", "problem_solving" -> "Flessibilita";
            case "value", "qualita_prezzo", "price_quality" -> "Qualita/Prezzo";
            default -> key;
        };
    }

    private String anonymizeEvaluator(String email) {
        if (email == null || email.isBlank()) return "Valutatore anonimo";
        int atIdx = email.indexOf('@');
        String local = atIdx > 0 ? email.substring(0, atIdx) : email;
        return "Val. " + local.substring(0, Math.min(local.length(), 8)) + ".";
    }

    private void appendEvaluationAudit(String eventKey, RevampEvaluation evaluation, UUID actorUserId) {
        UUID supplierId = evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getId() : null;
        String metadata = "{\"evaluationId\":\"" + evaluation.getId()
                + "\",\"supplierName\":\"" + esc(evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getDisplayName() : "")
                + "\",\"overallScore\":\"" + evaluation.getOverallScore() + "\"}";
        auditService.append(new RevampAuditEventInputDto(
                eventKey,
                "REVAMP_SUPPLIER_REGISTRY_PROFILE",
                supplierId,
                actorUserId,
                "VIEWER",
                null, null, null,
                "{\"overallScore\":\"" + evaluation.getOverallScore() + "\"}",
                metadata
        ));
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
