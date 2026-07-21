import { OpenPaymentWhatsAppButton } from "@/components/payments/open-payment-whatsapp-button";

export type PaymentReminderItem = {
  cycleId: string;
  subscriptionId: string;
  subscriberName: string;
  planName: string;
  amountLabel: string;
  dueDateLabel: string;
  daysUntilDue: number;
  whatsappUrl: string | null;
};

export function SubscriberPaymentReminder({
  tenantSlug,
  dueDateLabel,
  daysUntilDue,
}: {
  tenantSlug: string;
  dueDateLabel: string;
  daysUntilDue: number;
}) {
  return (
    <aside className="ori-payment-guide">
      <div className="ori-payment-guide-accent" aria-hidden />
      <div>
        <p className="ori-section-label text-blue-700">Próximo pago</p>
        <h3 className="mt-2 text-base font-semibold text-gray-900">
          {timingLabel(daysUntilDue)}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          Tu próximo pago por transferencia vence el {dueDateLabel}. Podés
          enviar el comprobante por WhatsApp o subirlo desde Pagos. El pedido se
          prepara cuando el comercio confirma el pago.
        </p>
        <a
          href={`/app/${tenantSlug}/pagos`}
          className="mt-3 inline-block text-sm font-medium text-gray-900 underline underline-offset-4"
        >
          Ver opciones de pago →
        </a>
      </div>
    </aside>
  );
}

function timingLabel(days: number): string {
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return `Vencido hace ${overdueDays} día${overdueDays === 1 ? "" : "s"}`;
  }
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence mañana";
  return `Vence en ${days} días`;
}

export function PaymentReminderList({
  tenantSlug,
  reminders,
}: {
  tenantSlug: string;
  reminders: PaymentReminderItem[];
}) {
  return (
    <section className="mt-8 ori-card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ori-section-label">Acción humana</p>
          <h2 className="mt-2 text-lg font-medium text-gray-900">
            Recordatorios de pago por enviar
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            El sistema detecta los vencimientos. Vos hacés el último clic y
            WhatsApp se abre con el mensaje listo.
          </p>
        </div>
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
          {reminders.length} pendiente{reminders.length === 1 ? "" : "s"}
        </span>
      </div>

      {reminders.length === 0 ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          No hay pagos para recordar en los próximos 7 días.
        </p>
      ) : (
        <ul className="space-y-3">
          {reminders.map((reminder) => (
            <li
              key={reminder.subscriptionId}
              className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {reminder.subscriberName}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {reminder.planName} · {reminder.amountLabel}
                </p>
                <p className="mt-1 text-xs font-medium text-blue-700">
                  {timingLabel(reminder.daysUntilDue)} ·{" "}
                  {reminder.dueDateLabel}
                </p>
              </div>
              {reminder.whatsappUrl ? (
                <OpenPaymentWhatsAppButton
                  tenantSlug={tenantSlug}
                  cycleId={reminder.cycleId}
                  whatsappUrl={reminder.whatsappUrl}
                />
              ) : (
                <span className="text-xs text-red-600">
                  Falta un teléfono válido
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
