"use client";

import { useActionState } from "react";

import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/app/auth/reset-password/actions";

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm({
  token,
  next,
}: {
  token: string;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="password" className="block text-sm text-gray-700">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none focus:border-gray-400"
        />
      </div>
      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm text-gray-700"
        >
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none focus:border-gray-400"
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
        className="ori-btn-primary w-full disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}
