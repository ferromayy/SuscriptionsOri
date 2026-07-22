import { createDbClient } from "@/lib/db/client";
import { isTenantManager } from "@/lib/auth/permissions";
import type { TenantMemberRole } from "@/types/database";

/** Org login is only for tenant owners/admins — never for bare subscribers. */
export async function assertManagerLoginAllowed(
  userId: string,
): Promise<string | null> {
  const db = createDbClient();
  const { data: memberships } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (memberships?.some((m) => isTenantManager(m.role as TenantMemberRole))) {
    return null;
  }

  if (memberships?.some((m) => m.role === "subscriber")) {
    return "Esta cuenta es de suscriptor. Ingresá desde el link de suscripciones de tu comercio.";
  }

  return "No encontramos una organización asociada a esta cuenta.";
}
