import type {
  AuthResponse,
  OtpChallengeDispatchResponse,
  OtpChallengeVerifyResponse
} from "../types/api";
import type { LoginFormValues, RegisterFormValues } from "../types/forms";
import { apiRequest } from "./http";

export function login(payload: LoginFormValues): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/v2/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function register(payload: RegisterFormValues): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/api/v2/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function acceptInvite(token: string, password: string): Promise<AuthResponse> {
  const revampPath = "/api/v2/auth/accept-invite";
  return apiRequest<AuthResponse>(revampPath, {
    method: "POST",
    body: JSON.stringify({ token, password })
  });
}

export function sendEmailOtpChallenge(token: string): Promise<OtpChallengeDispatchResponse> {
  return apiRequest<OtpChallengeDispatchResponse>("/api/v2/auth/otp/send-email", {
    method: "POST"
  }, token);
}

export function verifyEmailOtpChallenge(
  challengeId: string,
  otpCode: string,
  token: string
): Promise<OtpChallengeVerifyResponse> {
  return apiRequest<OtpChallengeVerifyResponse>("/api/v2/auth/otp/verify-email", {
    method: "POST",
    body: JSON.stringify({ challengeId, otpCode })
  }, token);
}

export function requestPasswordReset(email: string): Promise<OtpChallengeDispatchResponse> {
  return apiRequest<OtpChallengeDispatchResponse>("/api/v2/auth/forgot-password/request", {
    method: "POST",
    body: JSON.stringify({ email })
  });
}

export function resetPassword(challengeId: string, otpCode: string, newPassword: string): Promise<null> {
  return apiRequest<null>("/api/v2/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify({ challengeId, otpCode, newPassword })
  });
}
