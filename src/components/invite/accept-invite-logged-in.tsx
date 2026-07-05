"use client";

import { useState } from "react";

import { acceptInviteAsLoggedIn } from "@/app/invite/client/actions";

export function AcceptInviteLoggedIn({
  token,
  email,
  currentEmail,
}: {
  token: string;
  email: string;
  currentEmail: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (currentEmail !== email) {
    return (
      <p className="mt-6 text-sm text-red-400">
        Estás logueado como <strong>{currentEmail}</strong>, pero la invitación
        es para <strong>{email}</strong>. Cerrá sesión e ingresá con el email
        correcto.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-400">
        Ya tenés sesión como <strong className="text-slate-200">{email}</strong>
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await acceptInviteAsLoggedIn(token);
          if (result?.error) {
            setError(result.error);
            setPending(false);
          }
        }}
        className="mt-4 w-full rounded-lg bg-white px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
      >
        {pending ? "Aceptando..." : "Aceptar invitación"}
      </button>
      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
