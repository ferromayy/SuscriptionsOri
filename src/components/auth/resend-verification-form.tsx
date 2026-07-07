"use client";

import { useActionState } from "react";

import {
  resendVerificationAction,
  type AuthActionState,
} from "@/app/auth/actions";

const initialState: AuthActionState = { error: null };

export function ResendVerificationForm({ email }: { email?: string }) {
  const [state, formAction, pending] = useActionState(
    resendVerificationAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="email" value={email ?? ""} />
      {!email && (
        <input
          name="email"
          type="email"
          required
          placeholder="tu@email.com"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      )}
      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-gray-900">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-gray-400 disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Reenviar email de verificación"}
      </button>
    </form>
  );
}
