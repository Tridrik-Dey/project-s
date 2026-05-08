export const ATECO_FORMAT_ERROR = "Formato ATECO non valido. Usa solo numeri e punti, es. 85.42.09.";

const ATECO_CODE_RE = /^\d{2}(?:\.\d{1,2})?(?:\.\d{1,2})?$/;

export function normalizeAtecoCode(value: string): string {
  return value.trim().replace(",", ".");
}

export function isValidAtecoCode(value: string): boolean {
  const normalized = normalizeAtecoCode(value);
  return normalized.length === 0 || ATECO_CODE_RE.test(normalized);
}

