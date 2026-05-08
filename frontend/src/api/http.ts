import type { ApiResponse } from "../types/api";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8081";

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;

  if (!headers.has("Content-Type") && hasBody && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    if (isJson) {
      const errBody = (await response.json()) as ApiResponse<unknown>;
      throw new HttpError(errBody.message || "Request failed", response.status);
    }
    throw new HttpError(`Request failed with status ${response.status}`, response.status);
  }

  if (!isJson) {
    return undefined as T;
  }

  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new HttpError(body.message || "Request failed", response.status);
  }

  return body.data;
}

export async function apiBinaryRequest(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    throw new HttpError(`Request failed with status ${response.status}`, response.status);
  }

  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
  const blob = await response.blob();
  const fallbackName = blob.type.includes("spreadsheetml") ? "download.xlsx"
    : blob.type.includes("text/csv") ? "download.csv"
      : "download.bin";
  const filename = match?.[1] ?? fallbackName;

  return { blob, filename };
}
