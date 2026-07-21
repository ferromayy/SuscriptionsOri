"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  buildAuthorizationUrl,
  connectTenantWithAccessToken,
  createOAuthState,
  disconnectTenantMp,
  getTenantMpConnection,
  OAUTH_STATE_COOKIE,
  updateTransferDetails,
} from "@/lib/mercadopago/oauth";
import { createDbClient } from "@/lib/db/client";
import { isMercadoPagoConfigured } from "@/lib/mercadopago/env";
import { confirmPaymentCycle } from "@/lib/payments/payment-cycles";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export type PagosActionState = {
  error: string | null;
  success?: string | null;
};

export async function startMercadoPagoConnectAction(
  tenantSlug: string,
): Promise<void> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });

  if (!isMercadoPagoConfigured()) {
    redirect(`/app/${tenantSlug}/pagos?error=not_configured`);
  }

  const state = createOAuthState(tenant.id, tenant.slug);
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });

  redirect(buildAuthorizationUrl(state));
}

export async function connectWithAccessTokenAction(
  tenantSlug: string,
  _prev: PagosActionState,
  formData: FormData,
): Promise<PagosActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });

  try {
    const result = await connectTenantWithAccessToken(
      tenant.id,
      String(formData.get("accessToken") ?? ""),
    );
    if ("error" in result) {
      return { error: result.error };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el Access Token",
    };
  }

  revalidatePath(`/app/${tenantSlug}/pagos`);
  return { error: null, success: "Mercado Pago conectado con Access Token" };
}

export async function disconnectMercadoPagoAction(
  tenantSlug: string,
): Promise<PagosActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });

  try {
    await disconnectTenantMp(tenant.id);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo desconectar Mercado Pago",
    };
  }

  revalidatePath(`/app/${tenantSlug}/pagos`);
  return { error: null, success: "Mercado Pago desconectado" };
}

export async function saveTransferDetailsAction(
  tenantSlug: string,
  _prev: PagosActionState,
  formData: FormData,
): Promise<PagosActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });

  const connection = await getTenantMpConnection(tenant.id);
  if (!connection) {
    return { error: "Primero conectá Mercado Pago" };
  }

  const result = await updateTransferDetails(tenant.id, {
    transferCbu: String(formData.get("transferCbu") ?? ""),
    transferAlias: String(formData.get("transferAlias") ?? ""),
    transferHolderName: String(formData.get("transferHolderName") ?? ""),
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(`/app/${tenantSlug}/pagos`);
  return { error: null, success: "Datos de transferencia guardados" };
}

export async function confirmRenewalCycleAction(
  tenantSlug: string,
  cycleId: string,
): Promise<PagosActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });
  const result = await confirmPaymentCycle({
    cycleId,
    tenantId: tenant.id,
    source: "transfer",
  });
  if ("error" in result) return { error: result.error };

  revalidatePath(`/app/${tenantSlug}`);
  revalidatePath(`/app/${tenantSlug}/pagos`);
  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  return { error: null, success: "Pago confirmado y próximo ciclo generado" };
}

export async function markReminderWhatsAppOpenedAction(
  tenantSlug: string,
  cycleId: string,
): Promise<PagosActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/pagos`,
    requireManager: true,
  });
  const db = createDbClient();
  const { error } = await db
    .from("payment_cycles")
    .update({
      reminder_whatsapp_opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cycleId)
    .eq("tenant_id", tenant.id);
  if (error) return { error: error.message };
  revalidatePath(`/app/${tenantSlug}/pagos`);
  return { error: null, success: "WhatsApp abierto" };
}
