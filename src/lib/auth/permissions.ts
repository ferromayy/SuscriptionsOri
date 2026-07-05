import { createDbClient } from "@/lib/db/client";

import type { TenantMemberRole } from "@/types/database";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const db = createDbClient();
  const { data } = await db
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export async function getTenantRole(
  userId: string,
  tenantId: string,
): Promise<TenantMemberRole | null> {
  const db = createDbClient();
  const { data } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();

  return (data?.role as TenantMemberRole | undefined) ?? null;
}

export function isTenantManager(role: TenantMemberRole | null): boolean {
  return role === "owner" || role === "admin";
}
