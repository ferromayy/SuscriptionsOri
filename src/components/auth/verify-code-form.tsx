"use client";

import { useActionState } from "react";

import {
  verifyCodeAction,
  type VerifyCodeState,
} from "@/app/auth/verify-email/actions";

const initialState: VerifyCodeState = { error: null };

export function VerifyCodeForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    verifyCodeAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="email" value={email} />
      <div>
        <label htmlFor="code" className="block text-sm text-slate-300">
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          placeholder="000000"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-slate-500"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
      >
        {pending ? "Verificando..." : "Verificar y activar"}
      </button>
    </form>
  );
}
