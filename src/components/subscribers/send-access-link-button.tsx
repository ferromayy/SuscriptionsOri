"use client";

import { useState, useTransition } from "react";

import { sendSubscriberAccessLinkAction } from "@/app/app/[tenantSlug]/suscriptores/actions";

export function SendAccessLinkButton({
  tenantSlug,
  userId,
}: {
  tenantSlug: string;
  userId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendSubscriberAccessLinkAction(tenantSlug, userId);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.success ?? "Link enviado");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Enviar link de acceso"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && <p className="mt-2 text-xs text-gray-700">{success}</p>}
    </div>
  );
}
