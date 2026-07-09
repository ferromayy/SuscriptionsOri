"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole } from "@/lib/auth/permissions";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { loadResolvedPlan } from "@/lib/plans/load-resolved-plan";
import { validateFieldChoices } from "@/lib/plans/pricing-utils";
import { fieldChoiceSchema, type FieldChoiceInput } from "@/lib/plans/schemas";
import {
  checkoutDetailsSchema,
  type CheckoutDetailsInput,
} from "@/lib/subscribers/checkout-schemas";
import { upsertSubscriberSubscription } from "@/lib/subscribers/join-subscriber";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export type SubscriptionActionState = {
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

function parseCheckout(
  raw: FormDataEntryValue | null,
): { error: string } | { data: CheckoutDetailsInput | null } {
  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return { data: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = checkoutDetailsSchema.safeParse(parsed);
    if (!result.success) {
      return {
        error:
          result.error.issues[0]?.message ??
          "Completá contacto, entrega y pago",
      };
    }
    return { data: result.data };
  } catch {
    return { error: "No se pudieron leer los datos de checkout" };
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

  const checkoutParsed = parseCheckout(formData.get("checkout"));
  if ("error" in checkoutParsed) {
    return { error: checkoutParsed.error };
  }

  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const requireCheckout = formData.get("requireCheckout") === "1";

  if (!tenantSlug || !planId) {
    return { error: "Elegí una suscripción" };
  }

  if (requireCheckout && !checkoutParsed.data) {
    return { error: "Completá contacto, entrega y pago" };
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.status !== "active") {
    return { error: "Organización no disponible" };
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

  const result = await upsertSubscriberSubscription(
    user.id,
    tenant.id,
    tenant.slug,
    planId,
    fieldChoices,
    checkoutParsed.data,
  );

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(`/app/${tenantSlug}`);
  redirect(result.redirectUrl ?? `/app/${tenantSlug}`);
}
