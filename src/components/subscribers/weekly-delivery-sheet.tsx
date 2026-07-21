import Link from "next/link";

import { DeliveryActionButtons } from "@/components/subscribers/delivery-action-buttons";
import {
  formatCycleDateShort,
  formatWeekRangeLabel,
  getCycleDatesInRange,
  getSundaySaturdayWeek,
  normalizeBillingCycleDays,
  toDateKey,
  weekdayLabel,
} from "@/lib/subscribers/billing-cycle";
import { billingCycleLabel } from "@/lib/plans/money";
import { deliveryMethodLabel } from "@/lib/subscribers/status-labels";
import type { BillingCycleDays } from "@/lib/subscribers/checkout-schemas";
import type {
  DeliveryFulfillmentStatus,
  DeliveryMethod,
  PaymentCycleStatus,
} from "@/types/database";

export type WeeklyDeliveryChoice = {
  fieldLabel: string;
  value: string;
};

export type WeeklyDeliveryRow = {
  deliveryDate: Date;
  dueOn: string;
  subscriptionId: string;
  userId: string;
  customerName: string;
  email: string;
  phone: string | null;
  planName: string;
  quantity: string;
  billingCycleDays: BillingCycleDays;
  deliveryMethod: DeliveryMethod | null;
  deliverySummary: string;
  fulfillmentStatus: "pending" | DeliveryFulfillmentStatus;
  paymentStatus: PaymentCycleStatus | "legacy_unknown";
};

function summarizeDelivery(
  method: DeliveryMethod | null,
  details: Record<string, string>,
): string {
  const methodLabel = deliveryMethodLabel(method);
  const parts = Object.entries(details)
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([key, value]) => `${key}: ${value}`);
  if (parts.length === 0) {
    return methodLabel;
  }
  return `${methodLabel} · ${parts.join(" · ")}`;
}

function pickQuantity(choices: WeeklyDeliveryChoice[]): string {
  const cantidad = choices.find((choice) =>
    /cantidad/i.test(choice.fieldLabel),
  );
  if (cantidad?.value.trim()) {
    return cantidad.value.trim();
  }
  const bolsa = choices.find((choice) => /bolsa|gr\b|kg\b/i.test(choice.value));
  if (bolsa?.value.trim()) {
    return bolsa.value.trim();
  }
  if (choices.length === 1 && choices[0]?.value.trim()) {
    return choices[0].value.trim();
  }
  return "—";
}

export function buildWeeklyDeliveryRows(input: {
  subscriptions: Array<{
    id: string;
    user_id: string;
    plan_id: string;
    status: string;
    billing_cycle_days: number | null;
    created_at: string;
    contact_email: string | null;
    contact_phone: string | null;
    contact_first_name: string | null;
    contact_last_name: string | null;
    delivery_method: string | null;
    delivery_details: Record<string, string> | null;
  }>;
  plansById: Map<string, { name: string }>;
  usersById: Map<string, { email: string; fullName: string | null }>;
  choicesBySubscription?: Map<string, WeeklyDeliveryChoice[]>;
  /** Key: `${subscriptionId}:${YYYY-MM-DD}` */
  fulfillmentByKey?: Map<string, DeliveryFulfillmentStatus>;
  /** Key: `${subscriptionId}:${YYYY-MM-DD}` */
  paymentStatusByKey?: Map<string, PaymentCycleStatus>;
  referenceDate?: Date;
}): { weekStart: Date; weekEnd: Date; rows: WeeklyDeliveryRow[] } {
  const { start: weekStart, end: weekEnd } = getSundaySaturdayWeek(
    input.referenceDate ?? new Date(),
  );

  const rows: WeeklyDeliveryRow[] = [];

  for (const sub of input.subscriptions) {
    if (sub.status !== "active") continue;

    const cycleDays = normalizeBillingCycleDays(sub.billing_cycle_days);
    const dates = getCycleDatesInRange(
      sub.created_at,
      cycleDays,
      weekStart,
      weekEnd,
    );
    if (dates.length === 0) continue;

    const user = input.usersById.get(sub.user_id);
    const contactName = [sub.contact_first_name, sub.contact_last_name]
      .filter(Boolean)
      .join(" ");
    const customerName =
      contactName || user?.fullName?.trim() || "Sin nombre";
    const email = sub.contact_email || user?.email || "Sin email";
    const planName = input.plansById.get(sub.plan_id)?.name ?? "Plan";
    const deliveryMethod = (sub.delivery_method as DeliveryMethod | null) ?? null;
    const details = (sub.delivery_details ?? {}) as Record<string, string>;
    const choices = input.choicesBySubscription?.get(sub.id) ?? [];
    const quantity = pickQuantity(choices);

    for (const deliveryDate of dates) {
      const dueOn = toDateKey(deliveryDate);
      const fulfillmentStatus =
        input.fulfillmentByKey?.get(`${sub.id}:${dueOn}`) ?? "pending";

      rows.push({
        deliveryDate,
        dueOn,
        subscriptionId: sub.id,
        userId: sub.user_id,
        customerName,
        email,
        phone: sub.contact_phone,
        planName,
        quantity,
        billingCycleDays: cycleDays,
        deliveryMethod,
        deliverySummary: summarizeDelivery(deliveryMethod, details),
        fulfillmentStatus,
        paymentStatus:
          input.paymentStatusByKey?.get(`${sub.id}:${dueOn}`) ??
          "legacy_unknown",
      });
    }
  }

  rows.sort((a, b) => {
    const byDate = a.deliveryDate.getTime() - b.deliveryDate.getTime();
    if (byDate !== 0) return byDate;
    const byPlan = a.planName.localeCompare(b.planName, "es");
    if (byPlan !== 0) return byPlan;
    return a.customerName.localeCompare(b.customerName, "es");
  });

  return { weekStart, weekEnd, rows };
}

export function WeeklyDeliverySheet({
  tenantSlug,
  weekStart,
  weekEnd,
  rows,
}: {
  tenantSlug: string;
  weekStart: Date;
  weekEnd: Date;
  rows: WeeklyDeliveryRow[];
}) {
  return (
    <section className="mt-8 ori-card space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Entregas de la semana
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Domingo a sábado · {formatWeekRangeLabel(weekStart, weekEnd)}.
            Ordenado por fecha y plan. Usá WhatsApp para contacto, “Pedido
            finalizado” solo interno, y “Salió el envío” para avisar por email y
            WhatsApp.
          </p>
        </div>
        <p className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          {rows.length}{" "}
          {rows.length === 1 ? "entrega" : "entregas"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No hay entregas programadas para esta semana.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Día</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Ciclo</th>
                <th className="px-3 py-2 font-medium">Entrega</th>
                <th className="px-3 py-2 font-medium">Acciones</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.subscriptionId}-${row.dueOn}`}
                  className="border-b border-gray-100 align-top"
                >
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">
                    {formatCycleDateShort(row.deliveryDate)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 capitalize text-gray-700">
                    {weekdayLabel(row.deliveryDate)}
                  </td>
                  <td className="px-3 py-3 font-medium text-gray-900">
                    {row.planName}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-block rounded-md bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                      {row.quantity}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-900">
                    {row.customerName}
                    {row.phone && (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {row.phone}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">
                    {billingCycleLabel(row.billingCycleDays)}
                  </td>
                  <td className="max-w-xs px-3 py-3 text-gray-600">
                    {row.deliverySummary}
                  </td>
                  <td className="px-3 py-3">
                    <DeliveryActionButtons
                      tenantSlug={tenantSlug}
                      subscriptionId={row.subscriptionId}
                      dueOn={row.dueOn}
                      customerName={row.customerName}
                      planName={row.planName}
                      quantity={row.quantity}
                      phone={row.phone}
                      status={row.fulfillmentStatus}
                      paymentConfirmed={
                        row.paymentStatus === "paid" ||
                        row.paymentStatus === "legacy_unknown"
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <Link
                      href={`/app/${tenantSlug}/suscriptores/${row.userId}`}
                      className="font-medium text-gray-800 underline-offset-4 hover:underline"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
