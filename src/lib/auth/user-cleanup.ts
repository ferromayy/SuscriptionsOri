import { createDbClient } from "@/lib/db/client";
import { isPlatformAdmin } from "@/lib/auth/permissions";

export async function userHasAnyTenantMembership(userId: string): Promise<boolean> {
  const db = createDbClient();
  const { count } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return (count ?? 0) > 0;
}

export async function isOrphanAppUser(userId: string): Promise<boolean> {
  if (await isPlatformAdmin(userId)) {
    return false;
  }

  return !(await userHasAnyTenantMembership(userId));
}
