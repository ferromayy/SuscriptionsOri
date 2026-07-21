/**
 * Argentine postal codes:
 * - Classic: 4 digits (e.g. 1425)
 * - CPA (Correo Argentino): letter + 4 digits + 3 letters (e.g. C1425ABC)
 */

const CLASSIC_CP_RE = /^\d{4}$/;
const CPA_RE = /^[A-Z]\d{4}[A-Z]{3}$/;

export const ARGENTINE_POSTAL_CODE_HINT =
  "Usá el CP argentino: 4 dígitos (ej. 1425) o el CPA completo (ej. C1425ABC).";

export const ARGENTINE_POSTAL_CODE_GUIDE = [
  { label: "Clásico", example: "1425" },
  { label: "CPA", example: "C1425ABC" },
] as const;

export const ARGENTINE_POSTAL_CODE_ERROR =
  "Código postal inválido. Usá 4 dígitos (ej. 1425) o el CPA (ej. C1425ABC).";

/** Strip spaces/hyphens and uppercase letters for validation/storage. */
export function normalizeArgentinePostalCode(value: string): string {
  return value.replace(/[\s\-_.]/g, "").toUpperCase();
}

/**
 * Soft input mask while typing: keep only letters/digits, uppercase,
 * and cap length to CPA max (8).
 */
export function maskArgentinePostalCodeInput(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);

  // Prefer classic numeric entry when user starts with digits.
  if (/^\d/.test(cleaned)) {
    return cleaned.replace(/\D/g, "").slice(0, 4);
  }

  // CPA path: L + NNNN + LLL
  let out = "";
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i]!;
    if (out.length === 0) {
      if (/[A-Z]/.test(ch)) out += ch;
      continue;
    }
    if (out.length >= 1 && out.length <= 4) {
      if (/\d/.test(ch)) out += ch;
      continue;
    }
    if (out.length >= 5 && out.length <= 7) {
      if (/[A-Z]/.test(ch)) out += ch;
    }
  }
  return out;
}

export function isValidArgentinePostalCode(value: string): boolean {
  const normalized = normalizeArgentinePostalCode(value);
  if (!normalized) return false;
  return CLASSIC_CP_RE.test(normalized) || CPA_RE.test(normalized);
}
