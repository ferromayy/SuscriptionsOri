import "server-only";

import { createDbClient } from "@/lib/db/client";
import { deleteAllUserSessions } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import type { Database } from "@/types/database";

export type SoftDeleteTable = keyof Pick<
  Database["public"]["Tables"],
  | "users"
  | "tenants"
  | "tenant_members"
  | "plans"
  | "subscriptions"
  | "platform_invitations"
>;

function nowIso(): string {
  return new Date().toISOString();
}

export async function softDeleteWhere(
  table: SoftDeleteTable,
  column: string,
  value: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();
  const { error } = await db
    .from(table)
    .update({ deleted_at: nowIso() })
    .eq(column, value)
    .is("deleted_at", null);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function softDeleteById(
  table: SoftDeleteTable,
  id: string,
): Promise<{ error: string | null }> {
  return softDeleteWhere(table, "id", id);
}

export async function softDeleteUserIfOrphan(userId: string): Promise<void> {
  if (await isPlatformAdmin(userId)) {
    return;
  }

  const db = createDbClient();
  const { count } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  if ((count ?? 0) > 0) {
    return;
  }

  await softDeleteById("users", userId);
  await deleteAllUserSessions(userId);
}

export async function softDeleteUserAccount(
  userId: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();
  const deletedAt = nowIso();

  const { error: membersError } = await db
    .from("tenant_members")
    .update({ deleted_at: deletedAt })
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (membersError) {
    return { error: membersError.message };
  }

  const { error: subsError } = await db
    .from("subscriptions")
    .update({ deleted_at: deletedAt })
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (subsError) {
    return { error: subsError.message };
  }

  const { error: userError } = await db
    .from("users")
    .update({ deleted_at: deletedAt })
    .eq("id", userId)
    .is("deleted_at", null);

  if (userError) {
    return { error: userError.message };
  }

  await deleteAllUserSessions(userId);
  return { error: null };
}

export async function softDeleteTenantWithCleanup(
  tenantId: string,
): Promise<{ error: string | null }> {
  const db = createDbClient();
  const deletedAt = nowIso();

  const { data: members } = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const { data: invitations } = await db
    .from("platform_invitations")
    .select("email")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const memberUserIds = [...new Set((members ?? []).map((member) => member.user_id))];
  const inviteEmails = [
    ...new Set(
      (invitations ?? []).map((invitation) => invitation.email.trim().toLowerCase()),
    ),
  ];

  const childTables = [
    "subscriptions",
    "plans",
    "tenant_members",
    "platform_invitations",
  ] as const;

  for (const table of childTables) {
    const { error } = await db
      .from(table)
      .update({ deleted_at: deletedAt })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (error) {
      return { error: error.message };
    }
  }

  const { error: tenantError } = await db
    .from("tenants")
    .update({ deleted_at: deletedAt })
    .eq("id", tenantId)
    .is("deleted_at", null);

  if (tenantError) {
    return { error: tenantError.message };
  }

  for (const userId of memberUserIds) {
    await softDeleteUserIfOrphan(userId);
  }

  for (const email of inviteEmails) {
    const { data: user } = await db
      .from("users")
      .select("id")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (user) {
      await softDeleteUserIfOrphan(user.id);
    }
  }

  return { error: null };
}
