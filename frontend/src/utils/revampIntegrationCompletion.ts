import { answerRevampIntegrationRequest, completeRevampIntegrationItem } from "../api/revampApplicationApi";
import type { RevampIntegrationEditSession } from "./revampIntegrationEditSession";
import { integrationEditCodeList, requestRevampIntegrationDrawerReopen } from "./revampIntegrationEditSession";

export async function completeRevampIntegrationEdit(
  applicationId: string,
  token: string,
  session: RevampIntegrationEditSession | null
): Promise<void> {
  const codes = integrationEditCodeList(session);
  if (codes.length === 0) {
    await answerRevampIntegrationRequest(applicationId, token);
    return;
  }
  for (const code of codes) {
    await completeRevampIntegrationItem(applicationId, code, token);
  }
  if (session?.returnPath.includes("/my-profile") || session?.returnPath.includes("/dashboard/comunicazioni")) {
    requestRevampIntegrationDrawerReopen(applicationId);
  }
}

export function completedIntegrationCodes(payload: unknown): Set<string> {
  if (!payload || typeof payload !== "object") return new Set();
  const raw = (payload as { completedItemCodes?: unknown }).completedItemCodes;
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  );
}
