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
        <label htmlFor="email" className="block text-sm text-slate-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-slate-300">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50 outline-none focus:border-slate-500"
        />
      </div>
      {displayError && (
        <p className="text-sm text-red-400" role="alert">
          {displayError}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar como Super Admin"}
      </button>
    </form>
  );
}
