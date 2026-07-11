"use server";

import { revalidatePath } from "next/cache";

import { createDbClient } from "@/lib/db/client";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export type ConfirmTransferState = {
  error: string | null;
  success?: string | null;
};

export async function confirmTransferPaymentAction(
  tenantSlug: string,
  subscriptionId: string,
): Promise<ConfirmTransferState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();

  const { data: subscription, error: fetchError } = await db
    .from("subscriptions")
    .select("id, payment_method, status, payment_status")
    .eq("id", subscriptionId)
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !subscription) {
    return { error: "No se encontró la suscripción" };
  }

  if (subscription.payment_method !== "transfer") {
    return { error: "Solo se pueden confirmar pagos por transferencia" };
  }

  if (subscription.status === "active") {
    return { error: null, success: "Esta suscripción ya estaba activa" };
  }

  const { error: updateError } = await db
    .from("subscriptions")
    .update({
      status: "active",
      payment_status: "authorized",
    })
    .eq("id", subscription.id)
    .eq("tenant_id", tenant.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}`);
  return { error: null, success: "Transferencia confirmada. Suscripción activa." };
}
