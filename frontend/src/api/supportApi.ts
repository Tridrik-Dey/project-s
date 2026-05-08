import { apiRequest } from "./http";

interface SupportContactRequest {
  name: string;
  email: string;
  message: string;
  language?: string;
}

export async function submitSupportContact(request: SupportContactRequest): Promise<void> {
  await apiRequest<void>("/api/support/contact", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
