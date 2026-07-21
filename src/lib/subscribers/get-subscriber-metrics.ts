import "server-only";

import { createDbClient } from "@/lib/db/client";
import { billingCycleLabel } from "@/lib/plans/money";
import {
  getCycleDatesInRange,
  getSundaySaturdayWeek,
  normalizeBillingCycleDays,
  toDateKey,
} from "@/lib/subscribers/billing-cycle";
import {
  deliveryMethodLabel,
  paymentMethodLabel,
  subscriptionStatusLabel,
} from "@/lib/subscribers/status-labels";
import type {
  DeliveryFulfillmentStatus,
  DeliveryMethod,
  PaymentMethod,
  SubscriptionStatus,
} from "@/types/database";

export type MetricBreakdownItem = {
  key: string;
  label: string;
  count: number;
};

export type SubscriberMetrics = {
  registeredSubscribers: number;
  newSubscribersLast30Days: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  pendingPayment: number;
  pastDue: number;
  cancelled: number;
  estimatedMonthlyRevenueCents: number;
  revenueThisMonthCents: number;
  revenueLast30DaysCents: number;
  confirmedPaymentsThisMonth: number;
  byStatus: MetricBreakdownItem[];
  byPlan: MetricBreakdownItem[];
  byPaymentMethod: MetricBreakdownItem[];
  byBillingCycle: MetricBreakdownItem[];
  byDeliveryMethod: MetricBreakdownItem[];
  weekDeliveries: {
    total: number;
    pending: number;
    ready: number;
    shipped: number;
    weekLabelStart: Date;
    weekLabelEnd: Date;
  };
};

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function toBreakdown(
  map: Map<string, number>,
  labelFor: (key: string) => string,
): MetricBreakdownItem[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: labelFor(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

function estimatedMonthlyCents(
  priceCents: number,
  cycleDays: number | null,
): number {
  const days = normalizeBillingCycleDays(cycleDays);
  return Math.round((priceCents * 30) / days);
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function daysAgo(n: number, d = new Date()): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  out.setHours(0, 0, 0, 0);
  return out;
}

export async function getSubscriberMetrics(
  tenantId: string,
): Promise<SubscriberMetrics> {
  const db = createDbClient();
  const last30Iso = daysAgo(30).toISOString();
  const { start: weekStart, end: weekEnd } = getSundaySaturdayWeek();

  const [
    { count: registeredSubscribers },
    { count: newSubscribersLast30Days },
    { data: subscriptions },
    { data: plans },
    { data: paymentEvents },
    { data: fulfillments },
  ] = await Promise.all([
    db
      .from("tenant_members")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "subscriber")
      .is("deleted_at", null),
    db
      .from("tenant_members")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "subscriber")
      .is("deleted_at", null)
      .gte("created_at", last30Iso),
    db
      .from("subscriptions")
      .select(
        "id, plan_id, status, final_price_cents, billing_cycle_days, payment_method, delivery_method, created_at",
      )
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    db
      .from("plans")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    db
      .from("payment_events")
      .select("kind, amount_cents, paid_at, created_at")
      .eq("tenant_id", tenantId)
      .in("kind", ["confirmed", "charged"])
      .gte("paid_at", last30Iso),
    db
      .from("delivery_fulfillments")
      .select("subscription_id, due_on, status")
      .eq("tenant_id", tenantId)
      .gte("due_on", toDateKey(weekStart))
      .lte("due_on", toDateKey(weekEnd)),
  ]);

  const plansById = new Map((plans ?? []).map((p) => [p.id, p.name]));
  const fulfillmentByKey = new Map<string, DeliveryFulfillmentStatus>();
  // Ignore missing-table errors until migration is applied.
  if (fulfillments) {
    for (const row of fulfillments) {
      fulfillmentByKey.set(
        `${row.subscription_id}:${row.due_on}`,
        row.status as DeliveryFulfillmentStatus,
      );
    }
  }

  const statusMap = new Map<string, number>();
  const planMap = new Map<string, number>();
  const paymentMethodMap = new Map<string, number>();
  const cycleMap = new Map<string, number>();
  const deliveryMap = new Map<string, number>();

  let activeSubscriptions = 0;
  let pendingPayment = 0;
  let pastDue = 0;
  let cancelled = 0;
  let estimatedMonthlyRevenueCents = 0;
  let weekPending = 0;
  let weekReady = 0;
  let weekShipped = 0;
  let weekTotal = 0;

  for (const sub of subscriptions ?? []) {
    const status = sub.status as SubscriptionStatus;
    bump(statusMap, status);
    bump(planMap, sub.plan_id);
    bump(paymentMethodMap, sub.payment_method ?? "none");
    bump(
      cycleMap,
      String(normalizeBillingCycleDays(sub.billing_cycle_days)),
    );
    bump(deliveryMap, sub.delivery_method ?? "none");

    if (status === "active") {
      activeSubscriptions += 1;
      estimatedMonthlyRevenueCents += estimatedMonthlyCents(
        sub.final_price_cents ?? 0,
        sub.billing_cycle_days,
      );

      const cycleDays = normalizeBillingCycleDays(sub.billing_cycle_days);
      const dates = getCycleDatesInRange(
        sub.created_at,
        cycleDays,
        weekStart,
        weekEnd,
      );
      for (const date of dates) {
        weekTotal += 1;
        const key = `${sub.id}:${toDateKey(date)}`;
        const fulfillment = fulfillmentByKey.get(key);
        if (fulfillment === "shipped") weekShipped += 1;
        else if (fulfillment === "ready") weekReady += 1;
        else weekPending += 1;
      }
    } else if (status === "pending_payment") {
      pendingPayment += 1;
    } else if (status === "past_due") {
      pastDue += 1;
    } else if (status === "cancelled") {
      cancelled += 1;
    }
  }

  let revenueThisMonthCents = 0;
  let revenueLast30DaysCents = 0;
  let confirmedPaymentsThisMonth = 0;
  const monthStartMs = startOfMonth().getTime();

  for (const event of paymentEvents ?? []) {
    const paidAt = event.paid_at ?? event.created_at;
    const paidMs = paidAt ? new Date(paidAt).getTime() : 0;
    const amount = event.amount_cents ?? 0;
    revenueLast30DaysCents += amount;
    if (paidMs >= monthStartMs) {
      revenueThisMonthCents += amount;
      confirmedPaymentsThisMonth += 1;
    }
  }

  return {
    registeredSubscribers: registeredSubscribers ?? 0,
    newSubscribersLast30Days: newSubscribersLast30Days ?? 0,
    totalSubscriptions: subscriptions?.length ?? 0,
    activeSubscriptions,
    pendingPayment,
    pastDue,
    cancelled,
    estimatedMonthlyRevenueCents,
    revenueThisMonthCents,
    revenueLast30DaysCents,
    confirmedPaymentsThisMonth,
    byStatus: toBreakdown(statusMap, (key) =>
      subscriptionStatusLabel(key as SubscriptionStatus),
    ),
    byPlan: toBreakdown(
      planMap,
      (key) => plansById.get(key) ?? "Plan eliminado",
    ),
    byPaymentMethod: toBreakdown(paymentMethodMap, (key) =>
      key === "none"
        ? "Sin método"
        : paymentMethodLabel(key as PaymentMethod),
    ),
    byBillingCycle: toBreakdown(cycleMap, (key) =>
      billingCycleLabel(Number(key) as 15 | 30 | 45),
    ),
    byDeliveryMethod: toBreakdown(deliveryMap, (key) =>
      key === "none"
        ? "Sin entrega"
        : deliveryMethodLabel(key as DeliveryMethod),
    ),
    weekDeliveries: {
      total: weekTotal,
      pending: weekPending,
      ready: weekReady,
      shipped: weekShipped,
      weekLabelStart: weekStart,
      weekLabelEnd: weekEnd,
    },
  };
}
