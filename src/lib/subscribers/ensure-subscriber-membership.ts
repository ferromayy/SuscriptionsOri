import "server-only";

import { createDbClient } from "@/lib/db/client";
import type { JoinedVia } from "@/types/database";

/**
 * Registers the user as an active subscriber of the tenant.
 * Call only after the first payment is confirmed (subscription active).
 * Idempotent — keeps existing membership (including after later cancellations).
 */
export async function ensureSubscriberMembership(
  userId: string,
  tenantId: string,
  joinedVia: JoinedVia = "public_signup",
): Promise<{ ok: true } | { error: string }> {
  const db = createDbClient();

  const { data: existing } = await db
    .from("tenant_members")
    .select("id, role, status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    if (existing.role !== "subscriber") {
      return {
        error:
          "Este email pertenece a un administrador de la organización.",
      };
    }

    if (existing.status !== "active") {
      const { error } = await db
        .from("tenant_members")
        .update({ status: "active" })
        .eq("id", existing.id);
      if (error) {
        return { error: error.message };
      }
    }

    return { ok: true };
  }

  const { error } = await db.from("tenant_members").insert({
    tenant_id: tenantId,
    user_id: userId,
    role: "subscriber",
    joined_via: joinedVia,
    status: "active",
  });

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

export async function userHasPendingSubscription(
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const db = createDbClient();
  const { count } = await db
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .in("status", ["pending_payment", "pending_authorization"])
    .is("deleted_at", null);

  return (count ?? 0) > 0;
}
