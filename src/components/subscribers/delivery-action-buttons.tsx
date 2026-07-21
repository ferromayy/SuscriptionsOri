"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  markDeliveryReadyAction,
  markDeliveryShippedAction,
} from "@/app/app/[tenantSlug]/suscriptores/actions";
import { buildWhatsAppUrl } from "@/lib/subscribers/whatsapp";

export function DeliveryActionButtons({
  tenantSlug,
  subscriptionId,
  dueOn,
  customerName,
  planName,
  quantity,
  phone,
  status,
  paymentConfirmed,
}: {
  tenantSlug: string;
  subscriptionId: string;
  dueOn: string;
  customerName: string;
  planName: string;
  quantity: string;
  phone: string | null;
  status: "pending" | "ready" | "shipped";
  paymentConfirmed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const contactMessage = `Hola ${customerName.split(" ")[0] || ""}! Te escribo por tu suscripción de ${planName} (${quantity}).`;
  const contactUrl = buildWhatsAppUrl(phone, contactMessage.trim());

  function markReady() {
    setError(null);
    startTransition(async () => {
      const result = await markDeliveryReadyAction(
        tenantSlug,
        subscriptionId,
        dueOn,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function markShipped() {
    if (
      !window.confirm(
        "¿Confirmás que el pedido ya salió? Se enviará aviso por email y se abrirá WhatsApp si hay teléfono.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await markDeliveryShippedAction(
        tenantSlug,
        subscriptionId,
        dueOn,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.whatsappUrl) {
        window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-[10.5rem] flex-col gap-1.5">
      {contactUrl ? (
        <a
          href={contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#1ebe57]"
        >
          WhatsApp
        </a>
      ) : (
        <span className="text-center text-xs text-gray-400">Sin teléfono</span>
      )}

      {!paymentConfirmed && (
        <span className="rounded-md bg-amber-50 px-2 py-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-amber-800">
          Pago sin confirmar
        </span>
      )}

      {status === "pending" && (
        <button
          type="button"
          onClick={markReady}
          disabled={pending || !paymentConfirmed}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:border-gray-400 disabled:opacity-60"
          title="Marca interno: el pedido ya está armado/finalizado por nosotros"
        >
          {pending ? "…" : "Pedido finalizado"}
        </button>
      )}

      {status !== "shipped" && (
        <button
          type="button"
          onClick={markShipped}
          disabled={pending || !paymentConfirmed}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
          title="Avisa al cliente por email y WhatsApp que el envío ya salió"
        >
          {pending ? "…" : "Salió el envío"}
        </button>
      )}

      {status === "ready" && (
        <span className="text-center text-[0.65rem] font-medium uppercase tracking-wide text-amber-800">
          Listo (interno)
        </span>
      )}
      {status === "shipped" && (
        <span className="text-center text-[0.65rem] font-medium uppercase tracking-wide text-green-800">
          Enviado · aviso hecho
        </span>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
