"use client";

import { useActionState, useState } from "react";

import {
  signInAndAcceptInvite,
  signUpAndAcceptInvite,
  type InviteActionState,
} from "@/app/invite/client/actions";

const initialState: InviteActionState = { error: null };

type Mode = "signup" | "login";

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpAndAcceptInvite,
    initialState,
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signInAndAcceptInvite,
    initialState,
  );

  const error = mode === "signup" ? signUpState.error : signInState.error;
  const pending = mode === "signup" ? signUpPending : signInPending;

  return (
    <div className="mt-8">
      <div className="flex rounded-lg border border-gray-200 p-1">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md px-3 py-2 text-sm ${
            mode === "signup"
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md px-3 py-2 text-sm ${
            mode === "login"
              ? "bg-gray-900 text-white"
              : "text-gray-600 hover:text-gray-800"
          }`}
        >
          Ya tengo cuenta
        </button>
      </div>

      {mode === "signup" ? (
        <form action={signUpAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="block text-sm text-gray-700">Email</label>
            <input
              readOnly
              value={email}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-600"
            />
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm text-gray-700">
              Tu nombre
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
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
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <SubmitButton pending={pending} label="Crear cuenta y aceptar" />
        </form>
      ) : (
        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="block text-sm text-gray-700">Email</label>
            <input
              readOnly
              value={email}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-600"
            />
          </div>
          <div>
            <label htmlFor="loginPassword" className="block text-sm text-gray-700">
              Contraseña
            </label>
            <input
              id="loginPassword"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <SubmitButton pending={pending} label="Iniciar sesión y aceptar" />
        </form>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({
  pending,
  label,
}: {
  pending: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
    >
      {pending ? "Procesando..." : label}
    </button>
  );
}
