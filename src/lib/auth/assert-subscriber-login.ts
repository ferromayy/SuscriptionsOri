import { createDbClient } from "@/lib/db/client";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";

/**
 * Validates that a user may use the tenant subscriber login.
 * Returns null when OK, or an error message for the form.
 */
export async function assertSubscriberLoginAllowed(
  userId: string,
  tenantSlug: string,
): Promise<string | null> {
  const db = createDbClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, status")
    .eq("slug", tenantSlug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant || tenant.status !== "active") {
    return "Esta organización no está disponible.";
  }

  const role = await getTenantRole(userId, tenant.id);
  if (role === "subscriber") {
    return null;
  }
  if (isTenantManager(role)) {
    return "Esta cuenta es de gestión del comercio. Usá el acceso de organización.";
  }

  const { data: pendingSub } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenant.id)
    .in("status", ["pending_payment", "pending_authorization"])
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (pendingSub) {
    return null;
  }

  return "Esta cuenta no está asociada a este comercio como suscriptor.";
}
