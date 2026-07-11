"use client";

import { useState, useTransition } from "react";

import { resumeSubscriptionPaymentAction } from "@/app/app/[tenantSlug]/mi-suscripcion/actions";

export function ResumePaymentButton({
  tenantSlug,
  subscriptionId,
}: {
  tenantSlug: string;
  subscriptionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    startTransition(async () => {
      const result = await resumeSubscriptionPaymentAction(
        tenantSlug,
        subscriptionId,
      );
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="ori-btn-primary disabled:opacity-60"
      >
        {pending ? "Redirigiendo..." : "Completar pago"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
