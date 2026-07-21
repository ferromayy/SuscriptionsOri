"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole } from "@/lib/auth/permissions";
import { createDbClient } from "@/lib/db/client";
import { centsToPesos } from "@/lib/plans/money";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { loadResolvedPlan } from "@/lib/plans/load-resolved-plan";
import { validateFieldChoices } from "@/lib/plans/pricing-utils";
import { fieldChoiceSchema, type FieldChoiceInput } from "@/lib/plans/schemas";
import {
  buildSubscriptionBackUrl,
  createPendingPreapproval,
  isMpTestPayerEmail,
} from "@/lib/mercadopago/subscriptions";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import type { CheckoutDetailsInput } from "@/lib/subscribers/checkout-schemas";
import { billingCycleDaysSchema } from "@/lib/subscribers/checkout-schemas";
import { upsertSubscriberSubscription } from "@/lib/subscribers/join-subscriber";
import { resolveCheckoutFromFormData } from "@/lib/subscribers/resolve-checkout";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export type SubscriptionActionState = {
  error: string | null;
};

export type ResumePaymentState = {
  error: string | null;
};

function parseFieldChoices(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return z.array(fieldChoiceSchema).parse(parsed);
  } catch {
    return null;
  }
}

async function validateSubscriptionSelection(
  tenantId: string,
  planId: string,
  fieldChoices: FieldChoiceInput[],
): Promise<{ error: string } | { ok: true }> {
  const plan = await loadResolvedPlan(planId, tenantId);
  if (!plan) {
    return { error: "Elegí una suscripción válida" };
  }

  const validation = validateFieldChoices(plan, fieldChoices);
  if ("error" in validation) {
    return { error: validation.error };
  }

  return { ok: true };
}

export async function subscribeLoggedInSubscriber(
  _prev: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Iniciá sesión para continuar" };
  }

  const fieldChoices = parseFieldChoices(formData.get("fieldChoices"));
  if (fieldChoices === null) {
    return { error: "Las opciones elegidas no son válidas" };
  }

  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const requireCheckout = formData.get("requireCheckout") === "1";

  if (!tenantSlug || !planId) {
    return { error: "Elegí una suscripción" };
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.status !== "active") {
    return { error: "Organización no disponible" };
  }

  let checkout: CheckoutDetailsInput | null = null;
  if (requireCheckout) {
    const checkoutParsed = await resolveCheckoutFromFormData(
      formData,
      tenant.id,
    );
    if ("error" in checkoutParsed) {
      return { error: checkoutParsed.error };
    }
    checkout = checkoutParsed.data;
  }

  const plans = await getActivePlansForTenant(tenant.id);
  if (!plans.some((plan) => plan.id === planId)) {
    return { error: "Suscripción no válida" };
  }

  const role = await getTenantRole(user.id, tenant.id);
  if (role !== "subscriber") {
    return { error: "Solo los suscriptos pueden usar esta opción" };
  }

  const subscriptionValidation = await validateSubscriptionSelection(
    tenant.id,
    planId,
    fieldChoices,
  );
  if ("error" in subscriptionValidation) {
    return { error: subscriptionValidation.error };
  }

  const cycleParsed = billingCycleDaysSchema.safeParse(
    Number(formData.get("billingCycleDays")),
  );

  const result = await upsertSubscriberSubscription(
    user.id,
    tenant.id,
    tenant.slug,
    planId,
    fieldChoices,
    checkout,
    cycleParsed.success
      ? { billingCycleDays: cycleParsed.data }
      : undefined,
  );

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(`/app/${tenantSlug}`);
  redirect(result.redirectUrl ?? `/app/${tenantSlug}`);
}

export async function resumeSubscriptionPaymentAction(
  tenantSlug: string,
  subscriptionId: string,
  mpPayerEmail?: string,
): Promise<ResumePaymentState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Tenés que iniciar sesión" };
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.status !== "active") {
    return { error: "Organización no disponible" };
  }

  const role = await getTenantRole(user.id, tenant.id);
  if (role !== "subscriber") {
    return { error: "Solo los suscriptos pueden completar el pago" };
  }

  const db = createDbClient();
  const { data: subscription, error: fetchError } = await db
    .from("subscriptions")
    .select(
      "id, status, payment_method, billing_interval, final_price_cents, contact_email, mp_init_point, mp_preapproval_id, plan_id",
    )
    .eq("id", subscriptionId)
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !subscription) {
    return { error: "No se encontró la suscripción" };
  }

  if (subscription.status !== "pending_authorization") {
    return { error: "Esta suscripción no tiene un pago con tarjeta pendiente" };
  }

  if (subscription.payment_method === "transfer") {
    return {
      error:
        "Esta suscripción es por transferencia. El comercio tiene que confirmar el pago cuando lo reciba.",
    };
  }

  if (
    subscription.payment_method !== "card_monthly" &&
    subscription.payment_method !== "card_annual"
  ) {
    return { error: "No hay un medio de pago con tarjeta para retomar" };
  }

  const payerEmail = (mpPayerEmail || "").trim().toLowerCase();
  if (!payerEmail || !payerEmail.includes("@")) {
    return {
      error:
        "Ingresá el email de tu cuenta de Mercado Pago (puede ser distinto al de Ori)",
    };
  }

  const connection = await getTenantMpConnection(tenant.id);
  const useTestToken = process.env.MP_USE_TEST_TOKEN === "true";
  if (
    (useTestToken || (connection && !connection.liveMode)) &&
    !isMpTestPayerEmail(payerEmail)
  ) {
    return {
      error:
        "En modo test, el email de Mercado Pago tiene que ser de un usuario de prueba (@testuser.com).",
    };
  }

  const { data: plan } = await db
    .from("plans")
    .select("name")
    .eq("id", subscription.plan_id)
    .is("deleted_at", null)
    .maybeSingle();

  const billingInterval =
    subscription.billing_interval === "year" ? "year" : "month";
  const amountPesos =
    billingInterval === "year"
      ? centsToPesos(subscription.final_price_cents ?? 0) * 12
      : centsToPesos(subscription.final_price_cents ?? 0);

  if (amountPesos <= 0) {
    return { error: "El monto de la suscripción no es válido" };
  }

  try {
    const preapproval = await createPendingPreapproval({
      tenantId: tenant.id,
      reason: `${plan?.name ?? "Suscripción"} (${billingInterval === "year" ? "anual" : "mensual"})`,
      payerEmail,
      externalReference: subscription.id,
      amountPesos,
      billingInterval,
      backUrl: buildSubscriptionBackUrl(tenant.slug),
    });

    const { error: updateError } = await db
      .from("subscriptions")
      .update({
        mp_preapproval_id: preapproval.id,
        mp_init_point: preapproval.initPoint,
        payment_status: "pending",
      })
      .eq("id", subscription.id);

    if (updateError) {
      return { error: updateError.message };
    }

    redirect(preapproval.initPoint);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo retomar el pago con Mercado Pago",
    };
  }
}
