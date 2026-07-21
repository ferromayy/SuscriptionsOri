import "server-only";

import { createDbClient } from "@/lib/db/client";
import { normalizeBillingCycleDays } from "@/lib/subscribers/billing-cycle";

export type PaymentEventSource = "transfer" | "card" | "manual";
export type PaymentEventKind =
  | "submitted"
  | "confirmed"
  | "charged"
  | "rejected"
  | "cancelled";

export type RecordPaymentEventInput = {
  tenantId: string;
  subscriptionId: string;
  userId: string;
  source: PaymentEventSource;
  kind: PaymentEventKind;
  amountCents: number;
  billingCycleDays?: number | null;
  dueOn?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  paymentReceiptPath?: string | null;
  externalId?: string | null;
  notes?: string | null;
};

function toDateOnly(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toISOString().slice(0, 10);
}

export async function recordPaymentEvent(
  input: RecordPaymentEventInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const db = createDbClient();
  const { data, error } = await db
    .from("payment_events")
    .insert({
      tenant_id: input.tenantId,
      subscription_id: input.subscriptionId,
      user_id: input.userId,
      source: input.source,
      kind: input.kind,
      amount_cents: Math.max(0, Math.round(input.amountCents)),
      billing_cycle_days: normalizeBillingCycleDays(input.billingCycleDays),
      due_on: input.dueOn ?? null,
      paid_at:
        input.paidAt === undefined ? new Date().toISOString() : input.paidAt,
      payment_reference: input.paymentReference ?? null,
      payment_receipt_path: input.paymentReceiptPath ?? null,
      external_id: input.externalId ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "No se pudo registrar el pago" };
  }

  return { ok: true, id: data.id };
}

/**
 * Record a confirmed/first payment from an active subscription row.
 * Skips if a confirmed/charged event already exists for this subscription
 * (unless forceNewCycle is true for renewals).
 */
export async function recordConfirmedSubscriptionPayment(
  subscriptionId: string,
  options?: { forceNewCycle?: boolean; notes?: string },
): Promise<{ ok: true } | { error: string } | { skipped: true }> {
  const db = createDbClient();
  const { data: sub, error } = await db
    .from("subscriptions")
    .select(
      "id, tenant_id, user_id, final_price_cents, billing_cycle_days, payment_method, payment_reference, payment_receipt_path, created_at",
    )
    .eq("id", subscriptionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !sub) {
    return { error: error?.message ?? "Suscripción no encontrada" };
  }

  if (!options?.forceNewCycle) {
    const { count } = await db
      .from("payment_events")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", subscriptionId)
      .in("kind", ["confirmed", "charged"]);

    if ((count ?? 0) > 0) {
      return { skipped: true };
    }
  }

  const source: PaymentEventSource =
    sub.payment_method === "transfer"
      ? "transfer"
      : sub.payment_method === "card_monthly" ||
          sub.payment_method === "card_annual"
        ? "card"
        : "manual";

  return recordPaymentEvent({
    tenantId: sub.tenant_id,
    subscriptionId: sub.id,
    userId: sub.user_id,
    source,
    kind: "confirmed",
    amountCents: sub.final_price_cents ?? 0,
    billingCycleDays: sub.billing_cycle_days,
    dueOn: toDateOnly(sub.created_at),
    paidAt: new Date().toISOString(),
    paymentReference: sub.payment_reference,
    paymentReceiptPath: sub.payment_receipt_path,
    notes: options?.notes ?? null,
  });
}

export type PaymentEventRow = {
  id: string;
  subscriptionId: string;
  userId: string;
  source: PaymentEventSource;
  kind: PaymentEventKind;
  amountCents: number;
  billingCycleDays: number | null;
  dueOn: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
  planName?: string | null;
  subscriberName?: string | null;
  subscriberEmail?: string | null;
};

export async function listPaymentEvents(input: {
  tenantId: string;
  userId?: string;
  limit?: number;
}): Promise<PaymentEventRow[]> {
  const db = createDbClient();
  let query = db
    .from("payment_events")
    .select(
      "id, subscription_id, user_id, source, kind, amount_cents, billing_cycle_days, due_on, paid_at, payment_reference, created_at",
    )
    .eq("tenant_id", input.tenantId)
    .in("kind", ["confirmed", "charged", "submitted", "rejected"])
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (input.userId) {
    query = query.eq("user_id", input.userId);
  }

  const { data: events, error } = await query;
  if (error) {
    console.error("[payment_events] list failed", error.message);
    return [];
  }
  if (!events?.length) {
    return [];
  }

  const subscriptionIds = [...new Set(events.map((e) => e.subscription_id))];
  const userIds = [...new Set(events.map((e) => e.user_id))];

  const plansBySubscription = new Map<string, string>();
  if (subscriptionIds.length > 0) {
    const { data: subs } = await db
      .from("subscriptions")
      .select("id, plan_id")
      .in("id", subscriptionIds);
    const planIds = [...new Set((subs ?? []).map((s) => s.plan_id))];
    const planNames = new Map<string, string>();
    if (planIds.length > 0) {
      const { data: plans } = await db
        .from("plans")
        .select("id, name")
        .in("id", planIds);
      for (const plan of plans ?? []) {
        planNames.set(plan.id, plan.name);
      }
    }
    for (const sub of subs ?? []) {
      plansBySubscription.set(sub.id, planNames.get(sub.plan_id) ?? "Plan");
    }
  }

  const usersById = new Map<
    string,
    { email: string; fullName: string | null }
  >();
  if (userIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, email, full_name")
      .in("id", userIds);
    for (const user of users ?? []) {
      usersById.set(user.id, { email: user.email, fullName: user.full_name });
    }
  }

  return events.map((event) => {
    const user = usersById.get(event.user_id);
    return {
      id: event.id,
      subscriptionId: event.subscription_id,
      userId: event.user_id,
      source: event.source as PaymentEventSource,
      kind: event.kind as PaymentEventKind,
      amountCents: event.amount_cents,
      billingCycleDays: event.billing_cycle_days,
      dueOn: event.due_on,
      paidAt: event.paid_at,
      paymentReference: event.payment_reference,
      createdAt: event.created_at,
      planName: plansBySubscription.get(event.subscription_id) ?? null,
      subscriberName: user?.fullName ?? null,
      subscriberEmail: user?.email ?? null,
    };
  });
}
