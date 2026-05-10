export type AdminAttentionKind = "fieldChanges" | "newCandidatures";

export const ADMIN_CANDIDATURE_ATTENTION_SEEN_EVENT = "admin:candidature-attention-seen";

function safeIdentity(userId: string | null | undefined, email: string | null | undefined): string {
  return (userId || email || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function storageKey(kind: AdminAttentionKind, userId: string | null | undefined, email: string | null | undefined): string {
  return `admin.candidatureAttention.${safeIdentity(userId, email)}.${kind}.seen.v1`;
}

function readSeenSet(kind: AdminAttentionKind, userId: string | null | undefined, email: string | null | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(kind, userId, email));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenSet(kind: AdminAttentionKind, userId: string | null | undefined, email: string | null | undefined, ids: Set<string>) {
  try {
    localStorage.setItem(storageKey(kind, userId, email), JSON.stringify([...ids]));
  } catch {
    // Local storage can be unavailable in privacy modes; the UI still works without persistence.
  }
}

export function getUnseenAdminAttentionIds(
  kind: AdminAttentionKind,
  ids: readonly string[],
  userId: string | null | undefined,
  email: string | null | undefined
): string[] {
  const seen = readSeenSet(kind, userId, email);
  return ids.filter((id) => !seen.has(id));
}

export function markAdminAttentionSeen(
  kind: AdminAttentionKind,
  ids: readonly string[],
  userId: string | null | undefined,
  email: string | null | undefined
) {
  if (ids.length === 0) return;
  const seen = readSeenSet(kind, userId, email);
  ids.forEach((id) => seen.add(id));
  writeSeenSet(kind, userId, email, seen);
  window.dispatchEvent(new CustomEvent(ADMIN_CANDIDATURE_ATTENTION_SEEN_EVENT, { detail: { kind, ids } }));
}
