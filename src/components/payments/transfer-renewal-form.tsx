"use client";

import { useActionState } from "react";

import {
  submitTransferRenewalAction,
  type TransferRenewalState,
} from "@/app/app/[tenantSlug]/mi-suscripcion/actions";

const initialState: TransferRenewalState = { error: null };

export function TransferRenewalForm({
  tenantSlug,
  cycleId,
}: {
  tenantSlug: string;
  cycleId: string;
}) {
  const bound = submitTransferRenewalAction.bind(null, tenantSlug, cycleId);
  const [state, action, pending] = useActionState(bound, initialState);

  return (
    <form action={action} className="space-y-4" encType="multipart/form-data">
      <div>
        <label
          htmlFor={`payment-reference-${cycleId}`}
          className="block text-sm text-gray-700"
        >
          Número de operación
        </label>
        <input
          id={`payment-reference-${cycleId}`}
          name="paymentReference"
          className="ori-input mt-1"
          placeholder="Ej. 123456789"
        />
      </div>
      <div>
        <label
          htmlFor={`payment-receipt-${cycleId}`}
          className="block text-sm text-gray-700"
        >
          Comprobante (PDF o imagen)
        </label>
        <input
          id={`payment-receipt-${cycleId}`}
          name="paymentReceipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
      </div>
      <p className="text-xs text-gray-500">
        Completá al menos uno: número de operación o comprobante.
      </p>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-700" role="status">
          {state.success}
        </p>
      )}
      <button type="submit" disabled={pending} className="ori-btn-primary">
        {pending ? "Enviando..." : "Enviar comprobante"}
      </button>
    </form>
  );
}
