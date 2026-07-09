import { createDbClient } from "@/lib/db/client";

export async function resolvePostLogoutRedirect(
  userId: string,
): Promise<string> {
  const db = createDbClient();
  const { data: membership } = await db
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!membership) {
    return "/";
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("slug, status")
    .eq("id", membership.tenant_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant || tenant.status !== "active") {
    return "/";
  }

  return `/app/${tenant.slug}/join`;
}
