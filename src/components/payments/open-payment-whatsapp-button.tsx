"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markReminderWhatsAppOpenedAction } from "@/app/app/[tenantSlug]/pagos/actions";

export function OpenPaymentWhatsAppButton({
  tenantSlug,
  cycleId,
  whatsappUrl,
}: {
  tenantSlug: string;
  cycleId: string;
  whatsappUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="inline-flex justify-center whitespace-nowrap rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-[#073b1b] transition hover:bg-[#20bd5a] disabled:opacity-60"
        onClick={() => {
          const popup = window.open(
            whatsappUrl,
            "_blank",
            "noopener,noreferrer",
          );
          startTransition(async () => {
            const result = await markReminderWhatsAppOpenedAction(
              tenantSlug,
              cycleId,
            );
            if (result.error) {
              setError(result.error);
            } else {
              router.refresh();
            }
          });
          if (!popup) window.location.href = whatsappUrl;
        }}
      >
        {pending ? "Abriendo..." : "Abrir WhatsApp"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
