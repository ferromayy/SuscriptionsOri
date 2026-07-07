import type { Json } from "@/types/database";

export type TenantSettings = {
  allow_public_signup: boolean;
};

const DEFAULT_SETTINGS: TenantSettings = {
  allow_public_signup: true,
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
  };
}
