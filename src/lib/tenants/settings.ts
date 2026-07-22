import type { Json } from "@/types/database";

export type TenantSettings = {
  allow_public_signup: boolean;
  /** Local or E.164 WhatsApp for public join help (optional). */
  support_whatsapp: string | null;
};

const DEFAULT_SETTINGS: TenantSettings = {
  allow_public_signup: true,
  support_whatsapp: null,
};

export function parseTenantSettings(settings: Json | null): TenantSettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return DEFAULT_SETTINGS;
  }

  const record = settings as Record<string, unknown>;

  return {
    allow_public_signup:
      typeof record.allow_public_signup === "boolean"
        ? record.allow_public_signup
        : DEFAULT_SETTINGS.allow_public_signup,
    support_whatsapp:
      typeof record.support_whatsapp === "string" &&
      record.support_whatsapp.trim()
        ? record.support_whatsapp.trim()
        : DEFAULT_SETTINGS.support_whatsapp,
  };
}
