export function getSupabaseServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    ""
  );
}

const LOCAL_APP_URL = "http://localhost:3000";

/**
 * URL base de la app para links en emails e invitaciones.
 * - Local: NEXT_PUBLIC_APP_URL en .env.local (o localhost:3000)
 * - Vercel: NEXT_PUBLIC_APP_URL en el dashboard, o auto https://VERCEL_URL
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }

  const vercelHost = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercelHost) {
    return `https://${vercelHost}`;
  }

  return LOCAL_APP_URL;
}

export function getPublicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    appUrl: getAppUrl(),
  };
}

export function hasDatabaseConfig(): boolean {
  const { supabaseUrl } = getPublicEnv();
  return Boolean(supabaseUrl && getSupabaseServiceRoleKey());
}

export function getSuperAdminEmail(): string | null {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}
