"use client";

import { useState, useTransition } from "react";

import { resumeSubscriptionPaymentAction } from "@/app/app/[tenantSlug]/mi-suscripcion/actions";

export function ResumePaymentButton({
  tenantSlug,
  subscriptionId,
  defaultEmail = "",
}: {
  tenantSlug: string;
  subscriptionId: string;
  defaultEmail?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mpPayerEmail, setMpPayerEmail] = useState(defaultEmail);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);

    if (!mpPayerEmail.trim().includes("@")) {
      setError("Ingresá el email de tu cuenta de Mercado Pago");
      return;
    }

    startTransition(async () => {
      const result = await resumeSubscriptionPaymentAction(
        tenantSlug,
        subscriptionId,
        mpPayerEmail.trim(),
      );
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="space-y-3"
      onClick={(event) => event.stopPropagation()}
    >
      <div>
        <label
          htmlFor={`mp-payer-${subscriptionId}`}
          className="block text-sm text-amber-950"
        >
          Email de tu cuenta de Mercado Pago
        </label>
        <input
          id={`mp-payer-${subscriptionId}`}
          type="email"
          value={mpPayerEmail}
          onChange={(event) => setMpPayerEmail(event.target.value)}
          className="ori-input mt-1 bg-white"
          placeholder="el email con el que entrás a Mercado Pago"
        />
        <p className="mt-1 text-xs text-amber-800">
          Puede ser distinto al email con el que te registraste en Ori.
        </p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="ori-btn-primary disabled:opacity-60"
      >
        {pending ? "Redirigiendo..." : "Completar pago"}
      </button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
