import { apiRequest } from "./http";
import type { AdminRegistryProfileRow } from "./adminProfilesApi";

export interface AdminProfileTimelineEvent {
  id: string;
  eventKey: string;
  actorUserId: string | null;
  actorRoles: string | null;
  reason: string | null;
  beforeStateJson: string | null;
  afterStateJson: string | null;
  metadataJson: string | null;
  occurredAt: string;
}

export interface AdminNotificationEvent {
  id: string;
  eventKey: string;
  entityType: string;
  entityId: string | null;
  recipient: string | null;
  templateKey: string | null;
  templateVersion: number | null;
  deliveryStatus: string;
  retryCount: number;
  createdAt: string;
  sentAt: string | null;
}

export interface ComposeEmailPayload {
  subject: string;
  body: string;
}

const PROFILES_BASE = "/api/v2/profiles";
const NOTIFICATIONS_BASE = "/api/v2/notifications";

export function getAdminProfile(profileId: string, token: string): Promise<AdminRegistryProfileRow> {
  return apiRequest<AdminRegistryProfileRow>(`${PROFILES_BASE}/${encodeURIComponent(profileId)}`, {}, token);
}

export function getAdminProfileTimeline(profileId: string, token: string): Promise<AdminProfileTimelineEvent[]> {
  return apiRequest<AdminProfileTimelineEvent[]>(`${PROFILES_BASE}/${encodeURIComponent(profileId)}/timeline`, {}, token);
}

export function suspendAdminProfile(profileId: string, token: string): Promise<AdminRegistryProfileRow> {
  return apiRequest<AdminRegistryProfileRow>(
    `${PROFILES_BASE}/${encodeURIComponent(profileId)}/suspend`,
    { method: "POST" },
    token
  );
}

export function reactivateAdminProfile(profileId: string, token: string): Promise<AdminRegistryProfileRow> {
  return apiRequest<AdminRegistryProfileRow>(
    `${PROFILES_BASE}/${encodeURIComponent(profileId)}/reactivate`,
    { method: "POST" },
    token
  );
}

export function composeAdminEmail(profileId: string, payload: ComposeEmailPayload, token: string): Promise<void> {
  return apiRequest<void>(
    `${PROFILES_BASE}/${encodeURIComponent(profileId)}/compose-email`,
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export function getAdminProfileNotifications(profileId: string, token: string): Promise<AdminNotificationEvent[]> {
  const query = new URLSearchParams({
    entityType: "REVAMP_SUPPLIER_PROFILE",
    entityId: profileId
  }).toString();
  return apiRequest<AdminNotificationEvent[]>(
    `${NOTIFICATIONS_BASE}/events?${query}`,
    {},
    token
  );
}
