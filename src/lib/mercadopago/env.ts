import "server-only";

import { getAppUrl } from "@/lib/env";

export function getMpClientId(): string {
  return process.env.MP_CLIENT_ID?.trim() ?? "";
}

export function getMpClientSecret(): string {
  return process.env.MP_CLIENT_SECRET?.trim() ?? "";
}

export function getMpWebhookSecret(): string {
  return process.env.MP_WEBHOOK_SECRET?.trim() ?? "";
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(getMpClientId() && getMpClientSecret());
}

export function getMpOAuthRedirectUri(): string {
  return `${getAppUrl()}/api/mercadopago/oauth/callback`;
}

export function getMpApiBaseUrl(): string {
  return "https://api.mercadopago.com";
}

export function getMpAuthBaseUrl(): string {
  return "https://auth.mercadopago.com";
}
