"use client";

import { useActionState } from "react";

import {
  verifyInviteCodeAction,
  type InviteCodeState,
} from "@/app/invite/client/actions";

const initialState: InviteCodeState = { error: null };

export function InviteCodeForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    verifyInviteCodeAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-gray-600">
        Cuenta para <strong className="text-gray-800">{email}</strong>. Ingresá
        el código que te dio el administrador.
      </p>
      <div>
        <label htmlFor="inviteCode" className="block text-sm text-gray-700">
          Código de 6 dígitos
        </label>
        <input
          id="inviteCode"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          placeholder="000000"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-gray-400"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Verificando..." : "Continuar"}
      </button>
    </form>
  );
}
