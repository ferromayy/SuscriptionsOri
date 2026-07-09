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
  const { data: memberships } = await db.from("tenant_members").select("role, tenant_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!memberships?.length) {
    return "/";
  }

  const preferred =
    memberships.find((membership) =>
      isTenantManager(membership.role as TenantMemberRole),
    ) ?? memberships[0];

  const { data: tenant } = await db.from("tenants").select("slug")
    .eq("id", preferred.tenant_id)
    .maybeSingle();

  if (!tenant) {
    return "/";
  }

  return `/app/${tenant.slug}`;
}
