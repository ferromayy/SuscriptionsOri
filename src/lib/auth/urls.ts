export function getCheckEmailUrl(email: string, tenantSlug: string): string {
  return `/auth/check-email?email=${encodeURIComponent(email)}&tenant=${encodeURIComponent(tenantSlug)}`;
}
