import { createDbClient } from "@/lib/db/client";
import { isPlatformAdmin } from "@/lib/auth/permissions";

async function deleteUserIfOrphan(userId: string): Promise<void> {
  const db = createDbClient();

  if (await isPlatformAdmin(userId)) {
    return;
  }

  const { count } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) {
    return;
  }

  await db.from("users").delete().eq("id", userId);
}

export async function deleteTenantWithCleanup(
  tenantId: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();

  const { data: members } = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId);

  const { data: invitations } = await db
    .from("platform_invitations")
    .select("email")
    .eq("tenant_id", tenantId);

  const memberUserIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const inviteEmails = [
    ...new Set(
      (invitations ?? []).map((i) => i.email.trim().toLowerCase()),
    ),
  ];

  const { error } = await db.from("tenants").delete().eq("id", tenantId);

  if (error) {
    return { error: error.message };
  }

  for (const userId of memberUserIds) {
    await deleteUserIfOrphan(userId);
  }

  for (const email of inviteEmails) {
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (user) {
      await deleteUserIfOrphan(user.id);
    }
  }

  return { error: null };
}
