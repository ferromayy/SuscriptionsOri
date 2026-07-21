"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { passwordSchema } from "@/lib/auth/schemas";
import { requestPasswordReset } from "@/lib/auth/password-reset";
import { createDbClient } from "@/lib/db/client";
import { fieldChoiceSchema } from "@/lib/plans/schemas";
import { createManagedSubscriber } from "@/lib/subscribers/create-managed-subscriber";
import { ensureSubscriberMembership } from "@/lib/subscribers/ensure-subscriber-membership";
import { upsertSubscriberSubscription } from "@/lib/subscribers/join-subscriber";
import { recordConfirmedSubscriptionPayment } from "@/lib/payments/payment-events";
import { resolveCheckoutFromFormData } from "@/lib/subscribers/resolve-checkout";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export type ConfirmTransferState = {
  error: string | null;
  success?: string | null;
};

export type ManagedSubscriberState = {
  error: string | null;
  success?: string | null;
  userId?: string | null;
};

export type SubscriptionManageState = {
  error: string | null;
  success?: string | null;
};

/** Send password-reset / first-access email. Managers never see or set the new password. */
export async function sendSubscriberAccessLinkAction(
  tenantSlug: string,
  userId: string,
): Promise<SubscriptionManageState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/${userId}`,
    requireManager: true,
  });

  const db = createDbClient();
  const { data: member } = await db
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .eq("role", "subscriber")
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) {
    return { error: "El suscriptor no está registrado en esta organización" };
  }

  const { data: user } = await db
    .from("users")
    .select("email, email_verified_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    return { error: "No se encontró la cuenta" };
  }

  if (!user.email_verified_at) {
    await db
      .from("users")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("id", userId);
  }

  const result = await requestPasswordReset(user.email);
  if (result.error) {
    return { error: result.error };
  }

  return {
    error: null,
    success: `Enviamos un link a ${user.email} para que cree o restablezca su contraseña.`,
  };
}

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
    .select("id, payment_method, status, payment_status, user_id")
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
    const membership = await ensureSubscriberMembership(
      subscription.user_id,
      tenant.id,
    );
    if ("error" in membership) {
      return { error: membership.error };
    }
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

  const membership = await ensureSubscriberMembership(
    subscription.user_id,
    tenant.id,
  );
  if ("error" in membership) {
    return { error: membership.error };
  }

  await recordConfirmedSubscriptionPayment(subscription.id);

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}/suscriptores/${subscription.user_id}`);
  revalidatePath(`/app/${tenantSlug}`);
  revalidatePath(`/app/${tenantSlug}/pendiente`);
  revalidatePath(`/app/${tenantSlug}/pagos`);
  return { error: null, success: "Transferencia confirmada. Suscripción activa." };
}

export async function cancelSubscriptionAction(
  tenantSlug: string,
  subscriptionId: string,
): Promise<SubscriptionManageState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();

  const { data: subscription, error: fetchError } = await db
    .from("subscriptions")
    .select("id, status, user_id")
    .eq("id", subscriptionId)
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !subscription) {
    return { error: "No se encontró la suscripción" };
  }

  if (subscription.status === "cancelled") {
    return { error: null, success: "La suscripción ya estaba cancelada" };
  }

  const { error: updateError } = await db
    .from("subscriptions")
    .update({
      status: "cancelled",
      payment_status: "cancelled",
    })
    .eq("id", subscription.id)
    .eq("tenant_id", tenant.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}/suscriptores/${subscription.user_id}`);
  revalidatePath(`/app/${tenantSlug}`);
  return { error: null, success: "Suscripción cancelada" };
}

export async function activateSubscriptionAction(
  tenantSlug: string,
  subscriptionId: string,
): Promise<SubscriptionManageState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();

  const { data: subscription, error: fetchError } = await db
    .from("subscriptions")
    .select("id, status, user_id")
    .eq("id", subscriptionId)
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !subscription) {
    return { error: "No se encontró la suscripción" };
  }

  if (subscription.status === "active") {
    const membership = await ensureSubscriberMembership(
      subscription.user_id,
      tenant.id,
    );
    if ("error" in membership) {
      return { error: membership.error };
    }
    return { error: null, success: "La suscripción ya estaba activa" };
  }

  if (subscription.status === "cancelled") {
    return { error: "No se puede reactivar una suscripción cancelada desde acá" };
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

  const membership = await ensureSubscriberMembership(
    subscription.user_id,
    tenant.id,
  );
  if ("error" in membership) {
    return { error: membership.error };
  }

  await recordConfirmedSubscriptionPayment(subscription.id);

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}/suscriptores/${subscription.user_id}`);
  revalidatePath(`/app/${tenantSlug}`);
  revalidatePath(`/app/${tenantSlug}/pendiente`);
  revalidatePath(`/app/${tenantSlug}/pagos`);
  return { error: null, success: "Suscripción activada" };
}

const managedSchema = z.object({
  tenantSlug: z.string().min(1),
  planId: z.string().uuid("Elegí una suscripción"),
  existingUserId: z.string().uuid().optional().nullable(),
  password: z.string().optional(),
  authMode: z.enum(["signup", "login"]).default("signup"),
});

export async function createManagedSubscriberAction(
  _prev: ManagedSubscriberState,
  formData: FormData,
): Promise<ManagedSubscriberState> {
  const authMode =
    formData.get("authMode") === "login" ? "login" : "signup";
  const passwordRaw = String(formData.get("password") ?? "").trim();

  if (authMode === "signup") {
    const passwordCheck = passwordSchema.safeParse(passwordRaw);
    if (!passwordCheck.success) {
      return {
        error:
          passwordCheck.error.issues[0]?.message ??
          "Definí una contraseña para la cuenta nueva",
      };
    }
  }

  const parsed = managedSchema.safeParse({
    tenantSlug: formData.get("tenantSlug"),
    planId: formData.get("planId"),
    existingUserId: formData.get("existingUserId") || null,
    password: passwordRaw || undefined,
    authMode,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { tenantSlug, planId, existingUserId, password } = parsed.data;

  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/suscribir`,
    requireManager: true,
  });

  if (tenant.status !== "active") {
    return { error: "La organización no está activa" };
  }

  let fieldChoices: z.infer<typeof fieldChoiceSchema>[] = [];
  const rawChoices = formData.get("fieldChoices");
  if (typeof rawChoices === "string" && rawChoices.trim()) {
    try {
      fieldChoices = z.array(fieldChoiceSchema).parse(JSON.parse(rawChoices));
    } catch {
      return { error: "Las opciones del plan no son válidas" };
    }
  }

  const checkoutResolved = await resolveCheckoutFromFormData(
    formData,
    tenant.id,
  );
  if ("error" in checkoutResolved) {
    return { error: checkoutResolved.error };
  }

  const result = await createManagedSubscriber({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    email: checkoutResolved.data.email,
    password: password ?? null,
    fullName: `${checkoutResolved.data.firstName} ${checkoutResolved.data.lastName}`.trim(),
    authMode,
    existingUserId: existingUserId || null,
    planId,
    fieldChoices,
    checkout: checkoutResolved.data,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}/suscriptores/${result.userId}`);
  revalidatePath(`/app/${tenantSlug}`);

  return {
    error: null,
    success: result.createdUser
      ? "Suscriptor creado y suscripción activa."
      : "Suscripción activa.",
    userId: result.userId,
  };
}

export type ManagerUpsertState = {
  error: string | null;
};

/**
 * Add or edit a subscription for an existing subscriber (no password involved).
 * Transfer payments are confirmed immediately.
 */
export async function managerUpsertSubscriptionAction(
  _prev: ManagerUpsertState,
  formData: FormData,
): Promise<ManagerUpsertState> {
  const tenantSlug = String(formData.get("tenantSlug") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const requireCheckout = formData.get("requireCheckout") === "1";

  if (!tenantSlug || !planId || !targetUserId) {
    return { error: "Faltan datos de la suscripción" };
  }

  const fieldChoicesRaw = formData.get("fieldChoices");
  let fieldChoices: z.infer<typeof fieldChoiceSchema>[] = [];
  if (typeof fieldChoicesRaw === "string" && fieldChoicesRaw.trim()) {
    try {
      fieldChoices = z.array(fieldChoiceSchema).parse(JSON.parse(fieldChoicesRaw));
    } catch {
      return { error: "Las opciones del plan no son válidas" };
    }
  }

  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/${targetUserId}`,
    requireManager: true,
  });

  if (tenant.status !== "active") {
    return { error: "La organización no está activa" };
  }

  const db = createDbClient();
  const { data: member } = await db
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", targetUserId)
    .eq("role", "subscriber")
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) {
    return { error: "El suscriptor no pertenece a esta organización" };
  }

  let checkout = null;
  if (requireCheckout) {
    const checkoutResolved = await resolveCheckoutFromFormData(
      formData,
      tenant.id,
    );
    if ("error" in checkoutResolved) {
      return { error: checkoutResolved.error };
    }
    checkout = {
      ...checkoutResolved.data,
      paymentReference:
        checkoutResolved.data.paymentReference?.trim() ||
        "Confirmado por el comercio",
    };
  }

  const { billingCycleDaysSchema } = await import(
    "@/lib/subscribers/checkout-schemas"
  );
  const cycleParsed = billingCycleDaysSchema.safeParse(
    Number(formData.get("billingCycleDays")),
  );

  const result = await upsertSubscriberSubscription(
    targetUserId,
    tenant.id,
    tenant.slug,
    planId,
    fieldChoices,
    checkout,
    {
      skipTransferAccountCheck: true,
      ...(cycleParsed.success
        ? { billingCycleDays: cycleParsed.data }
        : checkout?.billingCycleDays
          ? { billingCycleDays: checkout.billingCycleDays }
          : {}),
    },
  );

  if ("error" in result) {
    return { error: result.error };
  }

  if (requireCheckout && checkout?.paymentMethod === "transfer") {
    const { error: activateError } = await db
      .from("subscriptions")
      .update({
        status: "active",
        payment_status: "authorized",
      })
      .eq("id", result.subscriptionId)
      .eq("tenant_id", tenant.id);

    if (activateError) {
      return { error: activateError.message };
    }

    const membership = await ensureSubscriberMembership(
      targetUserId,
      tenant.id,
      "client_invite",
    );
    if ("error" in membership) {
      return { error: membership.error };
    }

    await recordConfirmedSubscriptionPayment(result.subscriptionId);
  }

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}/suscriptores/${targetUserId}`);
  revalidatePath(`/app/${tenantSlug}`);
  revalidatePath(`/app/${tenantSlug}/pagos`);
  redirect(`/app/${tenantSlug}/suscriptores/${targetUserId}`);
}

export type DeliveryFulfillmentActionState = {
  error: string | null;
  success?: string | null;
  whatsappUrl?: string | null;
  emailSent?: boolean;
};

function toDateOnlyLocal(isoDate: string): string {
  // Accept YYYY-MM-DD or full ISO; normalize to YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function markDeliveryReadyAction(
  tenantSlug: string,
  subscriptionId: string,
  dueOn: string,
): Promise<DeliveryFulfillmentActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();
  const due = toDateOnlyLocal(dueOn);

  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .select("id, user_id, tenant_id, status")
    .eq("id", subscriptionId)
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (subError || !subscription) {
    return { error: subError?.message ?? "Suscripción no encontrada" };
  }

  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("delivery_fulfillments")
    .select("id, status, ready_at, shipped_at")
    .eq("subscription_id", subscriptionId)
    .eq("due_on", due)
    .maybeSingle();

  if (existing?.status === "shipped") {
    return { error: null, success: "Este pedido ya figuraba como enviado." };
  }

  const { error } = await db.from("delivery_fulfillments").upsert(
    {
      tenant_id: tenant.id,
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      due_on: due,
      status: "ready",
      ready_at: existing?.ready_at ?? now,
      updated_at: now,
    },
    { onConflict: "subscription_id,due_on" },
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  return { error: null, success: "Marcado como pedido finalizado (interno)." };
}

export async function markDeliveryShippedAction(
  tenantSlug: string,
  subscriptionId: string,
  dueOn: string,
): Promise<DeliveryFulfillmentActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();
  const due = toDateOnlyLocal(dueOn);

  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .select(
      "id, user_id, tenant_id, contact_email, contact_phone, contact_first_name, contact_last_name, plan_id, delivery_details",
    )
    .eq("id", subscriptionId)
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (subError || !subscription) {
    return { error: subError?.message ?? "Suscripción no encontrada" };
  }

  const { data: user } = await db
    .from("users")
    .select("email, full_name")
    .eq("id", subscription.user_id)
    .maybeSingle();

  const { data: plan } = await db
    .from("plans")
    .select("name")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  const { data: choices } = await db
    .from("subscription_choices")
    .select("field_id, option_id, text_value")
    .eq("subscription_id", subscriptionId)
    .is("deleted_at", null);

  const fieldIds = [...new Set((choices ?? []).map((c) => c.field_id))];
  const optionIds = [
    ...new Set(
      (choices ?? [])
        .map((c) => c.option_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const fieldsById = new Map<string, string>();
  const optionsById = new Map<string, string>();
  if (fieldIds.length > 0) {
    const { data: fields } = await db
      .from("plan_fields")
      .select("id, label")
      .in("id", fieldIds);
    for (const field of fields ?? []) {
      fieldsById.set(field.id, field.label);
    }
  }
  if (optionIds.length > 0) {
    const { data: options } = await db
      .from("plan_field_options")
      .select("id, label")
      .in("id", optionIds);
    for (const option of options ?? []) {
      optionsById.set(option.id, option.label);
    }
  }

  let quantity = "tu pedido";
  for (const choice of choices ?? []) {
    const label = fieldsById.get(choice.field_id) ?? "";
    const value =
      (choice.option_id
        ? optionsById.get(choice.option_id)
        : choice.text_value) ?? "";
    if (/cantidad/i.test(label) && value) {
      quantity = value;
      break;
    }
  }

  const customerName =
    [subscription.contact_first_name, subscription.contact_last_name]
      .filter(Boolean)
      .join(" ") ||
    user?.full_name ||
    "cliente";
  const email = subscription.contact_email || user?.email;
  const planName = plan?.name ?? "Suscripción";
  const [y, m, d] = due.split("-").map(Number);
  const deliveryDateLabel = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
  });

  const now = new Date().toISOString();
  const { data: existing } = await db
    .from("delivery_fulfillments")
    .select("id, ready_at, shipped_email_sent_at")
    .eq("subscription_id", subscriptionId)
    .eq("due_on", due)
    .maybeSingle();

  let emailSent = Boolean(existing?.shipped_email_sent_at);
  if (email && !emailSent) {
    const { sendShipmentNoticeEmail } = await import(
      "@/lib/email/send-shipment-notice"
    );
    try {
      const result = await sendShipmentNoticeEmail({
        to: email,
        customerName,
        tenantName: tenant.name,
        planName,
        quantity,
        deliveryDateLabel,
      });
      emailSent = result.emailSent;
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo enviar el email de aviso",
      };
    }
  }

  const { error } = await db.from("delivery_fulfillments").upsert(
    {
      tenant_id: tenant.id,
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      due_on: due,
      status: "shipped",
      ready_at: existing?.ready_at ?? now,
      shipped_at: now,
      shipped_email_sent_at:
        existing?.shipped_email_sent_at ?? (emailSent ? now : null),
      updated_at: now,
    },
    { onConflict: "subscription_id,due_on" },
  );

  if (error) {
    return { error: error.message };
  }

  const { buildWhatsAppUrl } = await import("@/lib/subscribers/whatsapp");
  const waMessage = `Hola ${customerName.split(" ")[0] || ""}! Tu pedido de ${planName} (${quantity}) con fecha ${deliveryDateLabel} ya salió en camino. Cualquier consulta, estamos a disposición. — ${tenant.name}`;
  const whatsappUrl = buildWhatsAppUrl(
    subscription.contact_phone,
    waMessage.trim(),
  );

  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  return {
    error: null,
    success: emailSent
      ? "Marcado como enviado y aviso por email enviado."
      : "Marcado como enviado. Revisá WhatsApp (email no enviado o sin configurar).",
    whatsappUrl,
    emailSent,
  };
}

