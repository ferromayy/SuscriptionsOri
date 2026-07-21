import "server-only";

import { createDbClient } from "@/lib/db/client";
import { sendPaymentReminderEmail } from "@/lib/email/send-payment-reminder";
import { getAppUrl } from "@/lib/env";
import { recordPaymentEvent } from "@/lib/payments/payment-events";
import { formatCents } from "@/lib/plans/money";
import { formatCycleDate } from "@/lib/subscribers/billing-cycle";
import { toDateKey } from "@/lib/subscribers/billing-cycle";
import type {
  PaymentCycleStatus,
  PaymentMethod,
} from "@/types/database";

const CYCLE_DAYS = 30;

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function statusForDueDate(dueOn: string, today = toDateKey(new Date())):
  | "upcoming"
  | "awaiting_payment"
  | "past_due" {
  if (dueOn < today) return "past_due";
  if (dueOn <= addDays(today, 7)) return "awaiting_payment";
  return "upcoming";
}

export type PaymentCycleRow = {
  id: string;
  tenantId: string;
  subscriptionId: string;
  userId: string;
  cycleNumber: number;
  periodStart: string;
  dueOn: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  status: PaymentCycleStatus;
  paymentReference: string | null;
  paymentReceiptPath: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  reminderEmailSentAt: string | null;
  reminderWhatsAppOpenedAt: string | null;
};

function mapCycle(row: {
  id: string;
  tenant_id: string;
  subscription_id: string;
  user_id: string;
  cycle_number: number;
  period_start: string;
  due_on: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  status: PaymentCycleStatus;
  payment_reference: string | null;
  payment_receipt_path: string | null;
  submitted_at: string | null;
  paid_at: string | null;
  reminder_email_sent_at: string | null;
  reminder_whatsapp_opened_at: string | null;
}): PaymentCycleRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subscriptionId: row.subscription_id,
    userId: row.user_id,
    cycleNumber: row.cycle_number,
    periodStart: row.period_start,
    dueOn: row.due_on,
    amountCents: row.amount_cents,
    paymentMethod: row.payment_method,
    status: row.status,
    paymentReference: row.payment_reference,
    paymentReceiptPath: row.payment_receipt_path,
    submittedAt: row.submitted_at,
    paidAt: row.paid_at,
    reminderEmailSentAt: row.reminder_email_sent_at,
    reminderWhatsAppOpenedAt: row.reminder_whatsapp_opened_at,
  };
}

export async function ensureCurrentPaymentCycle(
  subscriptionId: string,
): Promise<PaymentCycleRow | null> {
  const db = createDbClient();
  const { data: existing } = await db
    .from("payment_cycles")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .in("status", [
      "upcoming",
      "awaiting_payment",
      "submitted",
      "past_due",
      "failed",
    ])
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    if (existing.status !== "submitted") {
      const { data: currentSubscription } = await db
        .from("subscriptions")
        .select("final_price_cents")
        .eq("id", subscriptionId)
        .maybeSingle();
      const currentAmount = currentSubscription?.final_price_cents ?? 0;
      if (currentAmount !== existing.amount_cents) {
        const { data: updated } = await db
          .from("payment_cycles")
          .update({
            amount_cents: currentAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (updated) return mapCycle(updated);
      }
    }
    return mapCycle(existing);
  }

  const { data: subscription } = await db
    .from("subscriptions")
    .select(
      "id, tenant_id, user_id, status, payment_method, final_price_cents, created_at, payment_reference, payment_receipt_path",
    )
    .eq("id", subscriptionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (
    !subscription ||
    subscription.status === "cancelled" ||
    !subscription.payment_method
  ) {
    return null;
  }

  const { data: latestCycle } = await db
    .from("payment_cycles")
    .select("cycle_number, due_on")
    .eq("subscription_id", subscription.id)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: latestPayment } = await db
    .from("payment_events")
    .select("due_on, paid_at, created_at")
    .eq("subscription_id", subscription.id)
    .in("kind", ["confirmed", "charged"])
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const isInitialPending = subscription.status === "pending_payment";
  const startKey = toDateKey(new Date(subscription.created_at));
  const anchor =
    latestCycle?.due_on ??
    latestPayment?.due_on ??
    (latestPayment?.paid_at
      ? toDateKey(new Date(latestPayment.paid_at))
      : latestPayment?.created_at
        ? toDateKey(new Date(latestPayment.created_at))
        : startKey);
  const dueOn = isInitialPending ? startKey : addDays(anchor, CYCLE_DAYS);
  const hasProof = Boolean(
    subscription.payment_reference || subscription.payment_receipt_path,
  );
  const status: PaymentCycleStatus = isInitialPending
    ? hasProof
      ? "submitted"
      : "awaiting_payment"
    : statusForDueDate(dueOn);

  const { data: inserted, error } = await db
    .from("payment_cycles")
    .insert({
      tenant_id: subscription.tenant_id,
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      cycle_number: (latestCycle?.cycle_number ?? 0) + 1,
      period_start: anchor,
      due_on: dueOn,
      amount_cents: subscription.final_price_cents ?? 0,
      payment_method: subscription.payment_method,
      status,
      payment_reference: subscription.payment_reference,
      payment_receipt_path: subscription.payment_receipt_path,
      submitted_at: hasProof ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error || !inserted) {
    console.error("[payment_cycles] ensure failed", error?.message);
    return null;
  }
  return mapCycle(inserted);
}

export async function syncPaymentCycles(): Promise<{
  createdOrSynced: number;
  pastDue: number;
}> {
  const db = createDbClient();
  const { data: subscriptions } = await db
    .from("subscriptions")
    .select("id")
    .in("status", ["active", "past_due", "pending_payment"])
    .in("payment_method", ["transfer", "card_monthly", "card_annual"])
    .is("deleted_at", null);

  let createdOrSynced = 0;
  let pastDue = 0;
  for (const subscription of subscriptions ?? []) {
    const cycle = await ensureCurrentPaymentCycle(subscription.id);
    if (!cycle || cycle.status === "submitted") continue;
    const nextStatus = statusForDueDate(cycle.dueOn);
    if (nextStatus !== cycle.status) {
      await db
        .from("payment_cycles")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cycle.id);
      if (nextStatus === "past_due") {
        pastDue += 1;
        await db
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("id", cycle.subscriptionId)
          .neq("status", "cancelled");
      }
    }
    createdOrSynced += 1;
  }
  return { createdOrSynced, pastDue };
}

export async function submitTransferPaymentCycle(input: {
  cycleId: string;
  userId: string;
  paymentReference?: string | null;
  paymentReceiptPath?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const db = createDbClient();
  const { data: cycle } = await db
    .from("payment_cycles")
    .select("*")
    .eq("id", input.cycleId)
    .eq("user_id", input.userId)
    .eq("payment_method", "transfer")
    .in("status", ["upcoming", "awaiting_payment", "past_due", "failed"])
    .maybeSingle();
  if (!cycle) return { error: "No encontramos ese ciclo de pago pendiente" };
  if (!input.paymentReference?.trim() && !input.paymentReceiptPath?.trim()) {
    return { error: "Ingresá una operación o subí el comprobante" };
  }

  const submittedAt = new Date().toISOString();
  const { error } = await db
    .from("payment_cycles")
    .update({
      status: "submitted",
      payment_reference: input.paymentReference?.trim() || null,
      payment_receipt_path: input.paymentReceiptPath?.trim() || null,
      submitted_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq("id", cycle.id);
  if (error) return { error: error.message };

  await recordPaymentEvent({
    tenantId: cycle.tenant_id,
    subscriptionId: cycle.subscription_id,
    userId: cycle.user_id,
    source: "transfer",
    kind: "submitted",
    amountCents: cycle.amount_cents,
    billingCycleDays: CYCLE_DAYS,
    dueOn: cycle.due_on,
    paidAt: null,
    paymentReference: input.paymentReference,
    paymentReceiptPath: input.paymentReceiptPath,
    notes: `Comprobante del ciclo ${cycle.cycle_number}`,
  });
  return { ok: true };
}

export async function confirmPaymentCycle(input: {
  cycleId: string;
  tenantId: string;
  externalId?: string | null;
  source?: "transfer" | "card";
}): Promise<{ ok: true; nextCycleId: string | null } | { error: string }> {
  const db = createDbClient();
  const { data: cycle } = await db
    .from("payment_cycles")
    .select("*")
    .eq("id", input.cycleId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!cycle) return { error: "Ciclo de pago no encontrado" };
  if (cycle.status === "paid") return { ok: true, nextCycleId: null };

  const now = new Date().toISOString();
  const { error } = await db
    .from("payment_cycles")
    .update({
      status: "paid",
      paid_at: now,
      external_id: input.externalId ?? cycle.external_id,
      updated_at: now,
    })
    .eq("id", cycle.id);
  if (error) return { error: error.message };

  await db
    .from("subscriptions")
    .update({ status: "active", payment_status: "authorized" })
    .eq("id", cycle.subscription_id);
  const { ensureSubscriberMembership } = await import(
    "@/lib/subscribers/ensure-subscriber-membership"
  );
  const membership = await ensureSubscriberMembership(
    cycle.user_id,
    cycle.tenant_id,
    "public_signup",
  );
  if ("error" in membership) {
    return { error: membership.error };
  }
  await recordPaymentEvent({
    tenantId: cycle.tenant_id,
    subscriptionId: cycle.subscription_id,
    userId: cycle.user_id,
    source: input.source ?? (cycle.payment_method === "transfer" ? "transfer" : "card"),
    kind: input.source === "card" ? "charged" : "confirmed",
    amountCents: cycle.amount_cents,
    billingCycleDays: CYCLE_DAYS,
    dueOn: cycle.due_on,
    paidAt: now,
    paymentReference: cycle.payment_reference,
    paymentReceiptPath: cycle.payment_receipt_path,
    externalId: input.externalId,
    notes: `Ciclo ${cycle.cycle_number} confirmado`,
  });

  const nextDueOn = addDays(cycle.due_on, CYCLE_DAYS);
  const { data: nextCycle, error: nextError } = await db
    .from("payment_cycles")
    .upsert(
      {
        tenant_id: cycle.tenant_id,
        subscription_id: cycle.subscription_id,
        user_id: cycle.user_id,
        cycle_number: cycle.cycle_number + 1,
        period_start: cycle.due_on,
        due_on: nextDueOn,
        amount_cents: cycle.amount_cents,
        payment_method: cycle.payment_method,
        status: statusForDueDate(nextDueOn),
        updated_at: now,
      },
      { onConflict: "subscription_id,due_on" },
    )
    .select("id")
    .single();
  if (nextError) {
    console.error("[payment_cycles] next cycle failed", nextError.message);
  }
  return { ok: true, nextCycleId: nextCycle?.id ?? null };
}

export async function getOpenPaymentCycles(input: {
  tenantId: string;
  userId?: string;
}): Promise<PaymentCycleRow[]> {
  const db = createDbClient();
  let query = db
    .from("payment_cycles")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .in("status", ["upcoming", "awaiting_payment", "submitted", "past_due", "failed"])
    .order("due_on", { ascending: true });
  if (input.userId) query = query.eq("user_id", input.userId);
  const { data, error } = await query;
  if (error) {
    console.error("[payment_cycles] list failed", error.message);
    return [];
  }
  return (data ?? []).map(mapCycle);
}

export async function isCyclePaidForDelivery(
  subscriptionId: string,
  dueOn: string,
): Promise<boolean> {
  const db = createDbClient();
  const { data: cycle } = await db
    .from("payment_cycles")
    .select("status")
    .eq("subscription_id", subscriptionId)
    .eq("due_on", dueOn)
    .maybeSingle();
  if (cycle) return cycle.status === "paid";

  // Compatibility with the initial payment recorded before payment_cycles.
  const { count } = await db
    .from("payment_events")
    .select("*", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId)
    .eq("due_on", dueOn)
    .in("kind", ["confirmed", "charged"]);
  return (count ?? 0) > 0;
}

export async function sendDuePaymentReminderEmails(): Promise<{
  sent: number;
  skipped: number;
}> {
  const db = createDbClient();
  const today = toDateKey(new Date());
  const reminderLimit = addDays(today, 7);
  const { data: cycles } = await db
    .from("payment_cycles")
    .select("*")
    .in("status", ["awaiting_payment", "past_due"])
    .lte("due_on", reminderLimit)
    .is("reminder_email_sent_at", null);
  if (!cycles?.length) return { sent: 0, skipped: 0 };

  const subscriptionIds = [...new Set(cycles.map((c) => c.subscription_id))];
  const { data: subscriptions } = await db
    .from("subscriptions")
    .select(
      "id, tenant_id, plan_id, contact_email, contact_first_name, contact_last_name",
    )
    .in("id", subscriptionIds)
    .is("deleted_at", null);
  const planIds = [...new Set((subscriptions ?? []).map((s) => s.plan_id))];
  const tenantIds = [
    ...new Set((subscriptions ?? []).map((s) => s.tenant_id)),
  ];
  const [{ data: plans }, { data: tenants }] = await Promise.all([
    db.from("plans").select("id, name, currency").in("id", planIds),
    db.from("tenants").select("id, name, slug").in("id", tenantIds),
  ]);
  const subsById = new Map((subscriptions ?? []).map((s) => [s.id, s]));
  const plansById = new Map((plans ?? []).map((p) => [p.id, p]));
  const tenantsById = new Map((tenants ?? []).map((t) => [t.id, t]));

  let sent = 0;
  let skipped = 0;
  for (const cycle of cycles) {
    const sub = subsById.get(cycle.subscription_id);
    const plan = sub ? plansById.get(sub.plan_id) : null;
    const tenant = sub ? tenantsById.get(sub.tenant_id) : null;
    if (!sub?.contact_email || !tenant) {
      skipped += 1;
      continue;
    }
    const result = await sendPaymentReminderEmail({
      to: sub.contact_email,
      customerName:
        [sub.contact_first_name, sub.contact_last_name]
          .filter(Boolean)
          .join(" ") || "Hola",
      tenantName: tenant.name,
      planName: plan?.name ?? "tu suscripción",
      amountLabel: formatCents(
        cycle.amount_cents,
        plan?.currency ?? "ars",
        CYCLE_DAYS,
      ),
      dueDateLabel: formatCycleDate(
        new Date(`${cycle.due_on}T12:00:00`),
      ),
      accountUrl: `${getAppUrl()}/app/${tenant.slug}/pagos`,
    });
    if (result.emailSent) {
      sent += 1;
      await db
        .from("payment_cycles")
        .update({
          reminder_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cycle.id);
    } else {
      skipped += 1;
    }
  }
  return { sent, skipped };
}
