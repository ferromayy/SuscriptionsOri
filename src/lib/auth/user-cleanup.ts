import { createDbClient } from "@/lib/db/client";
import { isPlatformAdmin } from "@/lib/auth/permissions";

const OTHER_ORG_ERROR =
  "Este email ya está asociado a otra organización. Solo podés pertenecer a una.";

export async function userHasAnyTenantMembership(userId: string): Promise<boolean> {
  const db = createDbClient();
  const { count } = await db.from("tenant_members").select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}

export async function userHasActiveMembershipInOtherTenant(
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const db = createDbClient();
  const { count } = await db.from("tenant_members").select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("tenant_id", tenantId);

  return (count ?? 0) > 0;
}

export function otherOrganizationErrorMessage(): string {
  return OTHER_ORG_ERROR;
}

export async function isOrphanAppUser(userId: string): Promise<boolean> {
  if (await isPlatformAdmin(userId)) {
    return false;
  }

  return !(await userHasAnyTenantMembership(userId));
}
