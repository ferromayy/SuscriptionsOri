import { createDbClient } from "@/lib/db/client";
import { isTenantManager } from "@/lib/auth/permissions";
import type { TenantMemberRole } from "@/types/database";

export async function resolvePostLoginRedirect(
  userId: string,
  requestedNext: string,
): Promise<string> {
  const next = requestedNext.startsWith("/") ? requestedNext : "/";

  if (next !== "/") {
    return next;
  }

  const db = createDbClient();
  const { data: memberships } = await db
    .from("tenant_members")
    .select("role, tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (memberships?.length) {
    const preferred =
      memberships.find((membership) =>
        isTenantManager(membership.role as TenantMemberRole),
      ) ?? memberships[0];

    const { data: tenant } = await db
      .from("tenants")
      .select("slug")
      .eq("id", preferred.tenant_id)
      .maybeSingle();

    if (tenant) {
      return `/app/${tenant.slug}`;
    }
  }

  // First payment not confirmed yet — account exists but not registered as subscriber.
  const { data: pendingSub } = await db
    .from("subscriptions")
    .select("tenant_id")
    .eq("user_id", userId)
    .in("status", ["pending_payment", "pending_authorization"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingSub) {
    const { data: tenant } = await db
      .from("tenants")
      .select("slug")
      .eq("id", pendingSub.tenant_id)
      .maybeSingle();
    if (tenant) {
      return `/app/${tenant.slug}/pendiente`;
    }
  }

  return "/";
}
