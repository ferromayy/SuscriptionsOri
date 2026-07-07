"use client";

import * as React from "react";
import { useActionState } from "react";

import {
  adminLoginAction,
  type AuthActionState,
} from "@/app/auth/actions";

const initialState: AuthActionState = { error: null };

export function AdminLoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    adminLoginAction,
    initialState,
  );
  const [urlError, setUrlError] = React.useState<string | null>(null);

  React.useEffect(() => {
    searchParams.then((params) => {
      if (params.error === "unauthorized") {
        setUrlError("No tienes permisos de Super Admin");
      }
    });
  }, [searchParams]);

  const displayError = state.error ?? urlError;

  return (
    <form action={formAction} className="mt-8 space-y-4">
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
      <div>
        <label htmlFor="password" className="block text-sm text-gray-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 outline-none focus:border-gray-400"
        />
      </div>
      {displayError && (
        <p className="text-sm text-red-600" role="alert">
          {displayError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar como Super Admin"}
      </button>
    </form>
  );
}
