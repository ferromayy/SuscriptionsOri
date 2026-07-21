import Link from "next/link";

export function TransferPaymentGuide({
  tenantSlug,
  variant = "full",
}: {
  tenantSlug: string;
  variant?: "full" | "compact";
}) {
  if (variant === "compact") {
    return (
      <aside className="ori-payment-guide ori-payment-guide-compact">
        <div className="ori-payment-guide-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Recordatorio de pago
          </p>
          <p className="mt-1 text-sm text-gray-700">
            Una semana antes de cada envío te avisamos por WhatsApp. El pedido se
            prepara cuando el pago está confirmado.
          </p>
          <Link
            href={`/app/${tenantSlug}/pagos`}
            className="mt-3 inline-block text-sm font-medium text-gray-900 underline underline-offset-4"
          >
            Ver cómo funciona el pago →
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="ori-payment-guide">
      <div className="ori-payment-guide-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="ori-section-label text-[color:var(--ori-guide-label)]">
          Cómo pagás
        </p>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">
          Recordatorio de pago
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-gray-800">
          <li className="flex gap-3">
            <span className="ori-payment-guide-mark" aria-hidden>
              1
            </span>
            <span>
              Una semana antes de cada envío te recordaremos el pago por
              WhatsApp y también verás un aviso en tu cuenta.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="ori-payment-guide-mark" aria-hidden>
              2
            </span>
            <span>
              Podés enviar el comprobante por WhatsApp o subirlo directamente
              desde la web.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="ori-payment-guide-mark" aria-hidden>
              3
            </span>
            <span>
              Los pedidos se preparan una vez confirmado el pago.
            </span>
          </li>
        </ul>
      </div>
    </aside>
  );
}
