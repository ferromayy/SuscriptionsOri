/**
 * Contact field helpers for the subscriber checkout.
 * Phone is stored as a local Argentine number (no +54 / 9 country prefix).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export const LOCAL_PHONE_HINT =
  "Ingresá tu número local, sin +54 ni 9. Ejemplo: 3511234567 o 11 2345-6789.";

export const LOCAL_PHONE_COUNTRY_CODE_ERROR =
  "No incluyas +54 ni 9. Escribí solo el número local (ej. 3511234567).";

export const LOCAL_PHONE_FORMAT_ERROR =
  "Teléfono inválido. Usá entre 8 y 11 dígitos, sin código de país.";

export const EMAIL_FORMAT_ERROR =
  "Eso no parece un correo. Usá el formato nombre@ejemplo.com.";

/** Digits only, for storage / WhatsApp normalization later. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Soft input mask: keep digits, spaces and dashes.
 * Country-code characters like + are allowed only so we can detect and reject them.
 */
export function maskLocalPhoneInput(raw: string): string {
  return raw.replace(/[^\d+\s\-().]/g, "").slice(0, 20);
}

/** True if the value includes Argentina country code (+54 / 54 / 549…). */
export function hasArgentineCountryPrefix(value: string): boolean {
  const compact = value.trim().replace(/[\s\-().]/g, "");
  if (/^\+?54/.test(compact)) return true;
  const digits = digitsOnly(value);
  return digits.startsWith("54");
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > 254) return false;
  if (!EMAIL_RE.test(email)) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (!domain.includes(".")) return false;
  return true;
}

export function isValidLocalArgentinePhone(value: string): boolean {
  if (!value.trim()) return false;
  if (hasArgentineCountryPrefix(value)) return false;
  const digits = digitsOnly(value);
  return digits.length >= 8 && digits.length <= 11;
}

export function phoneValidationMessage(value: string): string | null {
  if (!value.trim()) return null;
  if (hasArgentineCountryPrefix(value)) return LOCAL_PHONE_COUNTRY_CODE_ERROR;
  if (!isValidLocalArgentinePhone(value)) return LOCAL_PHONE_FORMAT_ERROR;
  return null;
}

export function emailValidationMessage(value: string): string | null {
  if (!value.trim()) return null;
  if (!isValidEmail(value)) return EMAIL_FORMAT_ERROR;
  return null;
}

/** Normalize for DB: digits only, never with country code. */
export function normalizeLocalArgentinePhone(value: string): string {
  let digits = digitsOnly(value);
  if (digits.startsWith("549") && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith("54") && digits.length >= 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits;
}
