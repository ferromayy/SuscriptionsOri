"use client";

import { useActionState } from "react";

import {
  connectWithAccessTokenAction,
  type PagosActionState,
} from "@/app/app/[tenantSlug]/pagos/actions";

const initialState: PagosActionState = { error: null };

export function ConnectAccessTokenForm({ tenantSlug }: { tenantSlug: string }) {
  const bound = connectWithAccessTokenAction.bind(null, tenantSlug);
  const [state, formAction, pending] = useActionState(bound, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="accessToken" className="block text-sm text-gray-700">
          Access Token de producción
        </label>
        <input
          id="accessToken"
          name="accessToken"
          type="password"
          className="ori-input mt-1"
          placeholder="APP_USR-..."
          autoComplete="off"
          required
        />
        <p className="mt-2 text-xs text-gray-500">
          Lo encontrás en el panel de desarrolladores de Mercado Pago →
          tu aplicación → Credenciales de producción → Access Token.
        </p>
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
        {pending ? "Conectando..." : "Conectar con Access Token"}
      </button>
    </form>
  );
}
