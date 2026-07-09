"use client";

import { useActionState } from "react";

import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/app/auth/forgot-password/actions";

const initialState: ForgotPasswordState = { error: null, success: null };

export function ForgotPasswordForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="block text-sm text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
        {pending ? "Enviando..." : "Enviar link de recuperación"}
      </button>
    </form>
  );
}
