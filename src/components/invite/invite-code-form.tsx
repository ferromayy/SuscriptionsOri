"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    verifyInviteCodeAction,
    initialState,
  );

  useEffect(() => {
    if (state.verified) {
      router.refresh();
    }
  }, [state.verified, router]);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-slate-400">
        Cuenta para <strong className="text-slate-200">{email}</strong>. Ingresá
        el código que te dio el administrador.
      </p>
      <div>
        <label htmlFor="inviteCode" className="block text-sm text-slate-300">
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
        {pending ? "Verificando..." : "Verificar código"}
      </button>
    </form>
  );
}
