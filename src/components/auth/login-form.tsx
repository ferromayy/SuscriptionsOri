"use client";

import * as React from "react";
import { useActionState } from "react";

import { loginAction, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = { error: null };

export function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [next, setNext] = React.useState("/");

  React.useEffect(() => {
    searchParams.then((params) => {
      setNext(params.next ?? "/");
    });
  }, [searchParams]);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />
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
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm text-gray-700">
            Contraseña
          </label>
          <a
            href={`/auth/forgot-password${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-xs text-gray-600 hover:text-gray-900 underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
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
        className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
