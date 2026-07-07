"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
  type AccountActionState,
} from "@/app/app/[tenantSlug]/cuenta/actions";

const initialState: AccountActionState = { error: null };

function FormMessage({ state }: { state: AccountActionState }) {
  if (state.error) {
    return (
      <p className="mt-3 text-sm text-red-600" role="alert">
        {state.error}
      </p>
    );
  }

  if (state.success) {
    return (
      <p className="mt-3 text-sm text-gray-900" role="status">
        {state.success}
      </p>
    );
  }

  return null;
}

export function AccountSettings({
  tenantSlug,
  email,
  fullName,
}: {
  tenantSlug: string;
  email: string;
  fullName: string | null;
}) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAccountAction,
    initialState,
  );

  return (
    <div className="space-y-8">
      <section className="ori-card">
        <h2 className="text-lg font-medium text-gray-900">Datos personales</h2>
        <p className="mt-1 text-sm text-gray-600">
          Actualizá cómo aparece tu nombre en el portal.
        </p>

        <form action={profileAction} className="mt-6 space-y-4">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <div>
            <label className="block text-sm text-gray-700">Email</label>
            <input
              readOnly
              value={email}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-600"
            />
            <p className="mt-1 text-xs text-gray-500">
              El email no se puede cambiar por ahora.
            </p>
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm text-gray-700">
              Nombre
            </label>
            <input
              id="fullName"
              name="fullName"
              required
              minLength={2}
              defaultValue={fullName ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={profilePending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {profilePending ? "Guardando..." : "Guardar cambios"}
          </button>
          <FormMessage state={profileState} />
        </form>
      </section>

      <section className="ori-card">
        <h2 className="text-lg font-medium text-gray-900">Contraseña</h2>
        <p className="mt-1 text-sm text-gray-600">
          Usá una contraseña de al menos 8 caracteres.
        </p>

        <form action={passwordAction} className="mt-6 space-y-4">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm text-gray-700"
            >
              Contraseña actual
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm text-gray-700"
            >
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={passwordPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-60"
          >
            {passwordPending ? "Actualizando..." : "Cambiar contraseña"}
          </button>
          <FormMessage state={passwordState} />
        </form>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-medium text-red-800">Eliminar cuenta</h2>
        <p className="mt-1 text-sm text-gray-600">
          Se borrarán tu usuario, sesiones y membresía en esta organización. Esta
          acción no se puede deshacer.
        </p>

        <form action={deleteAction} className="mt-6 space-y-4">
          <input type="hidden" name="tenantSlug" value={tenantSlug} />
          <div>
            <label
              htmlFor="deletePassword"
              className="block text-sm text-gray-700"
            >
              Confirmá con tu contraseña
            </label>
            <input
              id="deletePassword"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-lg border border-red-300 bg-red-100 px-4 py-2 text-sm font-medium text-red-800 disabled:opacity-60"
          >
            {deletePending ? "Eliminando..." : "Eliminar mi cuenta"}
          </button>
          <FormMessage state={deleteState} />
        </form>
      </section>
    </div>
  );
}
