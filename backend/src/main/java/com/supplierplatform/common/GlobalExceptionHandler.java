package com.supplierplatform.common;

import com.supplierplatform.observability.RequestCorrelationFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.ObjectError;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidationErrors(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        String message = ex.getBindingResult().getAllErrors().stream()
                .map(error -> {
                    if (error instanceof FieldError fieldError) {
                        return fieldError.getDefaultMessage();
                    }
                    return ((ObjectError) error).getDefaultMessage();
                })
                .collect(Collectors.joining(", "));
        log.warn(
                "Validation error path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                message
        );
        return ResponseEntity.badRequest().body(ApiResponse.error(message, "VALIDATION_ERROR", requestId(request)));
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleEntityNotFound(EntityNotFoundException ex, HttpServletRequest request) {
        log.warn(
                "Entity not found path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getMessage(), "ENTITY_NOT_FOUND", requestId(request)));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Object>> handleIllegalState(IllegalStateException ex, HttpServletRequest request) {
        log.warn(
                "Illegal state path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(ex.getMessage(), "ILLEGAL_STATE", requestId(request)));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Object>> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        log.warn(
                "Illegal argument path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                ex.getMessage()
        );
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ex.getMessage(), "ILLEGAL_ARGUMENT", requestId(request)));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleDataIntegrityViolation(
            DataIntegrityViolationException ex,
            HttpServletRequest request
    ) {
        String message = resolveDataIntegrityMessage(ex);
        log.warn(
                "Data integrity violation path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                message
        );
        String errorCode = message != null && message.startsWith("DUPLICATE_")
                ? message
                : "DATA_INTEGRITY_VIOLATION";
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error(message, errorCode, requestId(request)));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiResponse<Object>> handleMissingParameter(
            MissingServletRequestParameterException ex,
            HttpServletRequest request
    ) {
        String message = ex.getParameterName() + " is required";
        log.warn(
                "Missing request parameter path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                message
        );
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(message, "MISSING_PARAMETER", requestId(request)));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request
    ) {
        String message = "Invalid value for " + ex.getName();
        log.warn(
                "Argument type mismatch path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                message
        );
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(message, "TYPE_MISMATCH", requestId(request)));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleMalformedJson(
            HttpMessageNotReadableException ex,
            HttpServletRequest request
    ) {
        log.warn(
                "Malformed request body path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                ex.getMessage()
        );
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("Malformed JSON request body", "MALFORMED_REQUEST", requestId(request)));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        log.warn(
                "Access denied path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Access denied: " + ex.getMessage(), "ACCESS_DENIED", requestId(request)));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleNoResourceFound(
            NoResourceFoundException ex,
            HttpServletRequest request
    ) {
        log.warn(
                "Resource not found path={} requestId={} message={}",
                request.getRequestURI(),
                requestId(request),
                ex.getMessage()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("Endpoint not found", "NOT_FOUND", requestId(request)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGenericException(Exception ex, HttpServletRequest request) {
        String requestId = requestId(request);
        log.error(
                "Unhandled exception path={} requestId={}",
                request.getRequestURI(),
                requestId,
                ex
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Internal server error. Request ID: " + requestId, "INTERNAL_SERVER_ERROR", requestId));
    }

    private String requestId(HttpServletRequest request) {
        String header = request.getHeader(RequestCorrelationFilter.REQUEST_ID_HEADER);
        if (header != null && !header.isBlank()) {
            return header;
        }
        String mdcRequestId = MDC.get(RequestCorrelationFilter.REQUEST_ID_MDC_KEY);
        if (mdcRequestId != null && !mdcRequestId.isBlank()) {
            return mdcRequestId;
        }
        return "N/A";
    }

    private String resolveDataIntegrityMessage(DataIntegrityViolationException ex) {
        String message = ex.getMostSpecificCause() != null
                ? ex.getMostSpecificCause().getMessage()
                : ex.getMessage();
        String normalized = message == null ? "" : message.toLowerCase();

        if (normalized.contains("supplier_profiles_vat_number_key") || normalized.contains("key (vat_number)")) {
            return "DUPLICATE_VAT_NUMBER";
        }
        if (normalized.contains("uk_applications_active_identity")) {
            if (normalized.contains("tax_code")) {
                return "validation.duplicate.taxId";
            }
            if (normalized.contains("vat_number")) {
                return "validation.duplicate.vatNumber";
            }
            return "validation.duplicate.generic";
        }
        if (normalized.contains("supplier_profiles_tax_id_key") || normalized.contains("key (tax_id)")) {
            return "DUPLICATE_TAX_ID";
        }
        if (normalized.contains("supplier_profiles_registration_number_key") || normalized.contains("key (registration_number)")) {
            return "DUPLICATE_REGISTRATION_NUMBER";
        }
        if (normalized.contains("users_email_key") || normalized.contains("key (email)")) {
            return "DUPLICATE_EMAIL";
        }
        return "DATA_INTEGRITY_VIOLATION";
    }
}
