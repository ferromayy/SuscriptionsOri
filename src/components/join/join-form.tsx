"use client";

import { useActionState, useState } from "react";

import {
  signInAndJoinAsSubscriber,
  signUpAsSubscriber,
  type JoinActionState,
} from "@/app/app/[tenantSlug]/join/actions";
import { formatPlanPrice } from "@/lib/plans/format-price";
import type { PublicPlan } from "@/lib/plans/get-plans";

const initialState: JoinActionState = { error: null };

type Mode = "signup" | "login";

export function JoinForm({
  tenantSlug,
  plans,
}: {
  tenantSlug: string;
  plans: PublicPlan[];
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpAsSubscriber,
    initialState,
  );
  const [signInState, signInAction, signInPending] = useActionState(
    signInAndJoinAsSubscriber,
    initialState,
  );

  const error = mode === "signup" ? signUpState.error : signInState.error;
  const pending = mode === "signup" ? signUpPending : signInPending;

  return (
    <div className="mt-8">
      <fieldset className="space-y-3">
        <legend className="text-sm text-gray-700">Elegí un plan</legend>
        {plans.map((plan) => (
          <label
            key={plan.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
              selectedPlanId === plan.id
                ? "border-gray-900 bg-gray-100"
                : "border-gray-200"
            }`}
          >
            <input
              type="radio"
              name="planChoice"
              value={plan.id}
              checked={selectedPlanId === plan.id}
              onChange={() => setSelectedPlanId(plan.id)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-gray-900">{plan.name}</span>
              <span className="block text-sm text-gray-600">
                {formatPlanPrice(plan)}
              </span>
              {plan.description && (
                <span className="mt-1 block text-xs text-gray-500">
                  {plan.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-6 flex rounded-lg border border-gray-200 p-1">
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
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input type="hidden" name="planId" value={selectedPlanId} />
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
            <label htmlFor="email" className="block text-sm text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
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
          <SubmitButton pending={pending} label="Crear cuenta y verificar email" />
        </form>
      ) : (
        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <input type="hidden" name="planId" value={selectedPlanId} />
          <div>
            <label htmlFor="loginEmail" className="block text-sm text-gray-700">
              Email
            </label>
            <input
              id="loginEmail"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label
              htmlFor="loginPassword"
              className="block text-sm text-gray-700"
            >
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
          <SubmitButton pending={pending} label="Iniciar sesión y suscribirme" />
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
