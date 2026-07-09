"use client";

import { useTransition } from "react";

import { disconnectMercadoPagoAction } from "@/app/app/[tenantSlug]/pagos/actions";

export function DisconnectMercadoPagoButton({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (
            !window.confirm(
              "¿Desconectar Mercado Pago? Los nuevos pagos con tarjeta dejarán de funcionar hasta que vuelvas a conectar.",
            )
          ) {
            return;
          }
          await disconnectMercadoPagoAction(tenantSlug);
          window.location.reload();
        })
      }
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
    >
      {pending ? "Desconectando..." : "Desconectar"}
    </button>
  );
}
