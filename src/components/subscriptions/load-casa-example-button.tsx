"use client";

import { useState, useTransition } from "react";

import { loadCasaExampleAction } from "@/app/app/[tenantSlug]/suscripciones/actions";

export function LoadCasaExampleButton({ tenantSlug }: { tenantSlug: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await loadCasaExampleAction(tenantSlug);
            setMessage(result.error);
            if (!result.error) {
              window.location.reload();
            }
          })
        }
        className="ori-btn-secondary"
      >
        {pending ? "Creando ejemplo..." : "Cargar «Suscripción casa» de ejemplo"}
      </button>
      {message && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
