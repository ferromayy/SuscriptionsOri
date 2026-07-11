import { createDbClient } from "@/lib/db/client";
import {
  otherOrganizationErrorMessage,
  userHasActiveMembershipInOtherTenant,
} from "@/lib/auth/user-cleanup";
import { centsToPesos } from "@/lib/plans/money";
import {
  calculateFinalPriceCents,
  validateFieldChoices,
} from "@/lib/plans/pricing-utils";
import { loadResolvedPlan } from "@/lib/plans/load-resolved-plan";
import type { FieldChoiceInput } from "@/lib/plans/schemas";
import {
  buildSubscriptionBackUrl,
  createPendingPreapproval,
} from "@/lib/mercadopago/subscriptions";
import {
  getTenantMpConnection,
} from "@/lib/mercadopago/oauth";
import {
  billingIntervalFromPaymentMethod,
  checkoutDetailsSchema,
  normalizeDeliveryDetails,
  resolveMpPayerEmail,
  type CheckoutDetailsInput,
} from "@/lib/subscribers/checkout-schemas";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

async function saveSubscriptionChoices(
  subscriptionId: string,
  choices: Array<{
    fieldId: string;
    optionId: string | null;
    textValue: string | null;
  }>,
): Promise<{ error: string } | { ok: true }> {
  const db = createDbClient();
  const deletedAt = new Date().toISOString();

  const { error: clearError } = await db
    .from("subscription_choices")
    .update({ deleted_at: deletedAt })
    .eq("subscription_id", subscriptionId)
    .is("deleted_at", null);

  if (clearError) {
    return { error: clearError.message };
  }

  if (choices.length === 0) {
    return { ok: true };
  }

  const choiceRows = choices.map((choice) => ({
    subscription_id: subscriptionId,
    field_id: choice.fieldId,
    option_id: choice.optionId,
    text_value: choice.textValue,
  }));

  const { error: choicesError } = await db
    .from("subscription_choices")
    .insert(choiceRows);

  if (choicesError) {
    return { error: choicesError.message };
  }

  return { ok: true };
}

function checkoutColumns(checkout: CheckoutDetailsInput) {
  return {
    contact_email: checkout.email.trim().toLowerCase(),
    contact_phone: checkout.phone.trim(),
    contact_first_name: checkout.firstName.trim(),
    contact_last_name: checkout.lastName.trim(),
    delivery_method: checkout.deliveryMethod,
    delivery_details: normalizeDeliveryDetails(
      checkout.deliveryMethod,
      checkout.deliveryDetails,
    ),
    payment_method: checkout.paymentMethod,
    billing_interval: billingIntervalFromPaymentMethod(checkout.paymentMethod),
    payment_reference: checkout.paymentReference?.trim() || null,
  };
}

export type UpsertSubscriptionResult =
  | { ok: true; subscriptionId: string; redirectUrl?: string }
  | { error: string };

export async function upsertSubscriberSubscription(
  userId: string,
  tenantId: string,
  tenantSlug: string,
  planId: string,
  fieldChoices: FieldChoiceInput[],
  checkout?: CheckoutDetailsInput | null,
): Promise<UpsertSubscriptionResult> {
  const plan = await loadResolvedPlan(planId, tenantId);
  if (!plan) {
    return { error: "Plan no disponible" };
  }

  const validation = validateFieldChoices(plan, fieldChoices);
  if ("error" in validation) {
    return { error: validation.error };
  }

  let parsedCheckout: CheckoutDetailsInput | null = null;
  if (checkout) {
    const checkoutResult = checkoutDetailsSchema.safeParse(checkout);
    if (!checkoutResult.success) {
      return {
        error:
          checkoutResult.error.issues[0]?.message ??
          "Completá los datos de contacto, entrega y pago",
      };
    }
    parsedCheckout = checkoutResult.data;
  }

  const finalPriceCents = calculateFinalPriceCents(plan, validation.choices);
  const db = createDbClient();

  const { data: existingSub } = await db
    .from("subscriptions")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingSub && !parsedCheckout) {
    const choicesResult = await saveSubscriptionChoices(
      existingSub.id,
      validation.choices,
    );
    if ("error" in choicesResult) {
      return choicesResult;
    }

    const { error: updateError } = await db
      .from("subscriptions")
      .update({ final_price_cents: finalPriceCents })
      .eq("id", existingSub.id);

    if (updateError) {
      return { error: updateError.message };
    }

    return { ok: true, subscriptionId: existingSub.id };
  }

  if (!parsedCheckout) {
    return {
      error: "Completá los datos de contacto, entrega y pago",
    };
  }

  const mpConnection = await getTenantMpConnection(tenantId);
  if (!mpConnection && parsedCheckout.paymentMethod !== "transfer") {
    return {
      error:
        "Este comercio todavía no conectó Mercado Pago. Probá más tarde o elegí transferencia.",
    };
  }

  if (parsedCheckout.paymentMethod === "transfer") {
    if (!mpConnection?.transferAlias && !mpConnection?.transferCbu) {
      return {
        error:
          "Este comercio todavía no cargó los datos de transferencia. Elegí pago con tarjeta.",
      };
    }
  }

  let subscriptionId = existingSub?.id ?? null;
  const initialStatus =
    parsedCheckout.paymentMethod === "transfer"
      ? "pending_payment"
      : "pending_authorization";

  if (existingSub) {
    const { error: updateError } = await db
      .from("subscriptions")
      .update({
        final_price_cents: finalPriceCents,
        status: initialStatus,
        payment_status: "pending",
        ...checkoutColumns(parsedCheckout),
      })
      .eq("id", existingSub.id);

    if (updateError) {
      return { error: updateError.message };
    }

    const choicesResult = await saveSubscriptionChoices(
      existingSub.id,
      validation.choices,
    );
    if ("error" in choicesResult) {
      return choicesResult;
    }
  } else {
    const { data: subscription, error: subError } = await db
      .from("subscriptions")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        plan_id: planId,
        status: initialStatus,
        payment_status: "pending",
        final_price_cents: finalPriceCents,
        ...checkoutColumns(parsedCheckout),
      })
      .select("id")
      .single();

    if (subError || !subscription) {
      return { error: subError?.message ?? "No se pudo crear la suscripción" };
    }

    subscriptionId = subscription.id;

    const choicesResult = await saveSubscriptionChoices(
      subscription.id,
      validation.choices,
    );
    if ("error" in choicesResult) {
      return choicesResult;
    }
  }

  if (!subscriptionId) {
    return { error: "No se pudo crear la suscripción" };
  }

  if (parsedCheckout.paymentMethod === "transfer") {
    return { ok: true, subscriptionId };
  }

  const billingInterval =
    billingIntervalFromPaymentMethod(parsedCheckout.paymentMethod) ?? "month";
  const amountPesos =
    billingInterval === "year"
      ? centsToPesos(finalPriceCents) * 12
      : centsToPesos(finalPriceCents);

  try {
    const preapproval = await createPendingPreapproval({
      tenantId,
      reason: `${plan.name} (${billingInterval === "year" ? "anual" : "mensual"})`,
      payerEmail: resolveMpPayerEmail(parsedCheckout),
      externalReference: subscriptionId,
      amountPesos,
      billingInterval,
      backUrl: buildSubscriptionBackUrl(tenantSlug),
    });

    const { error: mpUpdateError } = await db
      .from("subscriptions")
      .update({
        mp_preapproval_id: preapproval.id,
        mp_init_point: preapproval.initPoint,
        payment_status: "pending",
      })
      .eq("id", subscriptionId);

    if (mpUpdateError) {
      return { error: mpUpdateError.message };
    }

    return {
      ok: true,
      subscriptionId,
      redirectUrl: preapproval.initPoint,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo iniciar el pago con Mercado Pago";
    return { error: message };
  }
}

export async function completePublicSignup(
  userId: string,
  tenantSlug: string,
  planId: string,
  fieldChoices: FieldChoiceInput[] = [],
  checkout?: CheckoutDetailsInput | null,
): Promise<{ slug: string; redirectUrl?: string } | { error: string }> {
  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    return { error: "Organización no encontrada" };
  }

  if (tenant.status !== "active") {
    return { error: "Esta organización no acepta suscriptos por ahora" };
  }

  if (!tenant.allowPublicSignup) {
    return { error: "El registro público está deshabilitado" };
  }

  if (await userHasActiveMembershipInOtherTenant(userId, tenant.id)) {
    return { error: otherOrganizationErrorMessage() };
  }

  const db = createDbClient();

  const { data: existingMember } = await db
    .from("tenant_members")
    .select("id, role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingMember && existingMember.role !== "subscriber") {
    return {
      error:
        "Este email es del administrador. Registrate como suscriptor con otro email.",
    };
  }

  if (!existingMember) {
    const { error: memberError } = await db.from("tenant_members").insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: "subscriber",
      joined_via: "public_signup",
      status: "active",
    });

    if (memberError) {
      return { error: memberError.message };
    }
  }

  const subscriptionResult = await upsertSubscriberSubscription(
    userId,
    tenant.id,
    tenant.slug,
    planId,
    fieldChoices,
    checkout,
  );

  if ("error" in subscriptionResult) {
    return { error: subscriptionResult.error };
  }

  return {
    slug: tenant.slug,
    redirectUrl: subscriptionResult.redirectUrl,
  };
}
