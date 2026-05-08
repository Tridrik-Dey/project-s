import { API_BASE_URL, HttpError } from "./http";

export type DashboardActivityEvent = {
  eventId?: string;
  eventKey?: string;
  entityType?: string;
  entityId?: string | null;
  requestId?: string | null;
  occurredAt?: string;
};

type DashboardActivityHandler = (event: DashboardActivityEvent) => void;

export async function subscribeAdminDashboardEvents(
  token: string,
  signal: AbortSignal,
  onActivity: DashboardActivityHandler
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v2/audit/dashboard-stream`, {
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`
    },
    signal
  });

  if (!response.ok) {
    throw new HttpError(`Dashboard stream failed with status ${response.status}`, response.status);
  }

  if (!response.body) {
    throw new Error("Dashboard stream is not readable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsed = parseSseChunk(chunk);
      if (parsed.eventName !== "dashboard-activity") continue;
      onActivity(parsed.data);
    }
  }
}

function parseSseChunk(chunk: string): { eventName: string; data: DashboardActivityEvent } {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  const rawData = dataLines.join("\n");
  if (!rawData) return { eventName, data: {} };

  try {
    return { eventName, data: JSON.parse(rawData) as DashboardActivityEvent };
  } catch {
    return { eventName, data: {} };
  }
}
