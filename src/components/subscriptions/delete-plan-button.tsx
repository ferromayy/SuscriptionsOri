"use client";

import { useTransition } from "react";

import { deleteSubscriptionAction } from "@/app/app/[tenantSlug]/suscripciones/actions";

export function DeletePlanButton({
  tenantSlug,
  planId,
  planName,
  subscriberCount,
}: {
  tenantSlug: string;
  planId: string;
  planName: string;
  subscriberCount: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const message =
      subscriberCount > 0
        ? `¿Eliminar «${planName}»? ${subscriberCount} suscriptor${subscriberCount === 1 ? "" : "es"} la tienen activa; conservarán su suscripción pero dejará de aparecer en el link público.`
        : `¿Eliminar «${planName}»? Dejará de aparecer en el link público.`;

    if (!window.confirm(message)) {
      return;
    }

    startTransition(async () => {
      await deleteSubscriptionAction(tenantSlug, planId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-60"
    >
      {pending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
