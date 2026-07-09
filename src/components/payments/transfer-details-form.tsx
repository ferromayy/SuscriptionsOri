"use client";

import { useActionState } from "react";

import {
  saveTransferDetailsAction,
  type PagosActionState,
} from "@/app/app/[tenantSlug]/pagos/actions";

const initialState: PagosActionState = { error: null };

export function TransferDetailsForm({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: {
    transferCbu: string;
    transferAlias: string;
    transferHolderName: string;
  };
}) {
  const bound = saveTransferDetailsAction.bind(null, tenantSlug);
  const [state, formAction, pending] = useActionState(bound, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-700">Titular</label>
        <input
          name="transferHolderName"
          defaultValue={initial.transferHolderName}
          className="ori-input mt-1"
          placeholder="Nombre del titular"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700">Alias</label>
        <input
          name="transferAlias"
          defaultValue={initial.transferAlias}
          className="ori-input mt-1"
          placeholder="mi.negocio.mp"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-700">CBU / CVU</label>
        <input
          name="transferCbu"
          defaultValue={initial.transferCbu}
          className="ori-input mt-1"
          placeholder="0000000000000000000000"
        />
      </div>
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
        {pending ? "Guardando..." : "Guardar datos de transferencia"}
      </button>
    </form>
  );
}
