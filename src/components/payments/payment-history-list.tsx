import Link from "next/link";

import type { PaymentEventRow } from "@/lib/payments/payment-events";
import { billingCycleLabel } from "@/lib/plans/money";
import type { BillingCycleDays } from "@/lib/subscribers/checkout-schemas";

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
  });
}

function formatPaidAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDueOn(dateOnly: string | null): string {
  if (!dateOnly) return "—";
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function sourceLabel(source: PaymentEventRow["source"]): string {
  switch (source) {
    case "transfer":
      return "Transferencia";
    case "card":
      return "Tarjeta";
    default:
      return "Manual";
  }
}

function kindLabel(kind: PaymentEventRow["kind"]): string {
  switch (kind) {
    case "submitted":
      return "Enviado";
    case "confirmed":
      return "Confirmado";
    case "charged":
      return "Cobrado";
    case "rejected":
      return "Rechazado";
    case "cancelled":
      return "Cancelado";
    default:
      return kind;
  }
}

type PaymentHistoryListProps = {
  events: PaymentEventRow[];
  tenantSlug: string;
  showSubscriber?: boolean;
  emptyMessage?: string;
};

export function PaymentHistoryList({
  events,
  tenantSlug,
  showSubscriber = false,
  emptyMessage = "Todavía no hay pagos registrados.",
}: PaymentHistoryListProps) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-600">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-gray-200 border border-gray-200 bg-white">
      {events.map((event) => {
        const cycleDays = event.billingCycleDays as
          | BillingCycleDays
          | null
          | undefined;
        const subscriberLabel =
          event.subscriberName?.trim() ||
          event.subscriberEmail ||
          "Suscriptor";

        return (
          <li key={event.id} className="px-4 py-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-gray-900">
                {formatAmount(event.amountCents)}
                <span className="ml-2 font-normal text-gray-500">
                  · {sourceLabel(event.source)} · {kindLabel(event.kind)}
                </span>
              </p>
              {event.planName && (
                <p className="text-xs text-gray-500">{event.planName}</p>
              )}
            </div>

            <dl className="mt-2 grid gap-1 text-gray-700 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Fecha de pago</dt>
                <dd>{formatPaidAt(event.paidAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Día de cobro</dt>
                <dd>{formatDueOn(event.dueOn)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Ciclo</dt>
                <dd>{billingCycleLabel(cycleDays)}</dd>
              </div>
              {event.paymentReference && (
                <div>
                  <dt className="text-xs text-gray-500">Referencia</dt>
                  <dd className="break-all">{event.paymentReference}</dd>
                </div>
              )}
            </dl>

            {showSubscriber && (
              <p className="mt-2 text-xs text-gray-600">
                <Link
                  href={`/app/${tenantSlug}/suscriptores/${event.userId}`}
                  className="underline hover:text-gray-900"
                >
                  {subscriberLabel}
                </Link>
                {event.subscriberEmail && event.subscriberName
                  ? ` · ${event.subscriberEmail}`
                  : null}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
