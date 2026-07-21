/** Normalize phone for wa.me (defaults to Argentina +54 when missing). */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  if (!phone?.trim()) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (!digits.startsWith("54")) {
    digits = `54${digits}`;
  }
  if (
    digits.startsWith("54") &&
    !digits.startsWith("549") &&
    digits.length >= 12
  ) {
    digits = `549${digits.slice(2)}`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
