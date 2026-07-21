"use client";

import { useTransition, useState } from "react";

import {
  activateSubscriptionAction,
  cancelSubscriptionAction,
} from "@/app/app/[tenantSlug]/suscriptores/actions";

export function SubscriptionStatusActions({
  tenantSlug,
  subscriptionId,
  status,
}: {
  tenantSlug: string;
  subscriptionId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canActivate =
    status === "pending_payment" ||
    status === "pending_authorization" ||
    status === "past_due" ||
    status === "trialing";
  const canCancel = status !== "cancelled";

  function run(
    action: typeof cancelSubscriptionAction,
    confirmMessage: string,
  ) {
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action(tenantSlug, subscriptionId);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.success ?? "Listo");
      }
    });
  }

  if (!canActivate && !canCancel) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canActivate && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                activateSubscriptionAction,
                "¿Activar esta suscripción? Marcá solo si el pago ya está confirmado.",
              )
            }
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "…" : "Activar"}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                cancelSubscriptionAction,
                "¿Cancelar esta suscripción? El suscriptor dejará de tenerla activa.",
              )
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 disabled:opacity-60"
          >
            {pending ? "…" : "Cancelar"}
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && <p className="text-xs text-gray-700">{success}</p>}
    </div>
  );
}
