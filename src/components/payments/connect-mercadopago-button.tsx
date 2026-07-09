"use client";

import { startMercadoPagoConnectAction } from "@/app/app/[tenantSlug]/pagos/actions";

export function ConnectMercadoPagoButton({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  return (
    <form action={startMercadoPagoConnectAction.bind(null, tenantSlug)}>
      <button type="submit" className="ori-btn-primary">
        Conectar Mercado Pago
      </button>
    </form>
  );
}
