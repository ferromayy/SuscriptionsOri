"use client";

import { useState, useTransition } from "react";

import { confirmTransferPaymentAction } from "@/app/app/[tenantSlug]/suscriptores/actions";

export function ConfirmTransferButton({
  tenantSlug,
  subscriptionId,
}: {
  tenantSlug: string;
  subscriptionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (
      !window.confirm(
        "¿Confirmás que recibiste la transferencia? La suscripción pasará a activa.",
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await confirmTransferPaymentAction(
        tenantSlug,
        subscriptionId,
      );
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending}
        className="ori-btn-primary disabled:opacity-60"
      >
        {pending ? "Confirmando..." : "Confirmar transferencia"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
