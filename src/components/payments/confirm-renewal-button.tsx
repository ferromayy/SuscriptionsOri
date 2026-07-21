"use client";

import { useState, useTransition } from "react";

import { confirmRenewalCycleAction } from "@/app/app/[tenantSlug]/pagos/actions";

export function ConfirmRenewalButton({
  tenantSlug,
  cycleId,
}: {
  tenantSlug: string;
  cycleId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="ori-btn-primary"
        onClick={() => {
          if (!window.confirm("¿Confirmás que recibiste esta transferencia?")) {
            return;
          }
          startTransition(async () => {
            const result = await confirmRenewalCycleAction(tenantSlug, cycleId);
            setMessage(result.error ?? result.success ?? null);
          });
        }}
      >
        {pending ? "Confirmando..." : "Confirmar pago"}
      </button>
      {message && <p className="mt-2 text-xs text-gray-700">{message}</p>}
    </div>
  );
}
