import type { InviteTokenLookupResponse } from "../types/api";
import { apiRequest } from "./http";

export function getInviteByToken(token: string): Promise<InviteTokenLookupResponse> {
  return apiRequest<InviteTokenLookupResponse>(`/api/v2/invites/token/${encodeURIComponent(token)}`);
}
