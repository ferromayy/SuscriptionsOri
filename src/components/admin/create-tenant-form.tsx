"use client";

import { useActionState, useState } from "react";

import {
  createTenantWithInvitation,
  type CreateTenantState,
} from "@/app/admin/actions";
import { slugifyName } from "@/lib/validations/tenant";

const initialState: CreateTenantState = { error: null };

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState(
    createTenantWithInvitation,
    initialState,
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  if (state.success) {
    return <InviteSuccess result={state.success} />;
  }

  return (
    <form action={formAction} className="max-w-lg space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm text-gray-700">
          Nombre de la organización
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
          placeholder="Ej: Acme Corp"
          onChange={(e) => {
            if (!slugTouched) {
              setSlug(slugifyName(e.target.value));
            }
          }}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm text-gray-700">
          Slug (URL pública)
        </label>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
          placeholder="acme-corp"
        />
        <p className="mt-1 text-xs text-gray-500">
          Portal de suscriptos: /app/{slug || "slug"}/join
        </p>
        {state.fieldErrors?.slug && (
          <p className="mt-1 text-sm text-red-600">{state.fieldErrors.slug[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="ownerEmail" className="block text-sm text-gray-700">
          Email del cliente (owner)
        </label>
        <input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400"
          placeholder="cliente@empresa.com"
        />
        <p className="mt-1 text-xs text-gray-500">
          Debe usar este email al registrarse con el link de invitación.
        </p>
        {state.fieldErrors?.ownerEmail && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.ownerEmail[0]}
          </p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Creando..." : "Crear tenant e invitar cliente"}
      </button>
    </form>
  );
}

function InviteSuccess({
  result,
}: {
  result: NonNullable<CreateTenantState["success"]>;
}) {
  const expires = new Date(result.expiresAt).toLocaleDateString("es-AR", {
    dateStyle: "long",
  });

  return (
    <div className="max-w-xl ori-card-solid">
      <h2 className="text-lg font-semibold text-gray-900">
        Tenant creado — compartí la invitación
      </h2>
      <p className="mt-2 text-sm text-gray-700">
        <strong>{result.tenantName}</strong> ({result.tenantSlug}) — enviá el
        link y el código a <strong>{result.ownerEmail}</strong>. El cliente abre
        el link, ingresa el código y elige su contraseña.
      </p>
      <p className="mt-1 text-xs text-gray-500">La invitación expira: {expires}</p>

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
          Código de verificación
        </p>
        <div className="mt-2 flex items-center gap-2">
          <p className="flex-1 text-center font-mono text-3xl font-bold tracking-[0.35em] text-gray-900">
            {result.inviteCode}
          </p>
          <CopyButton text={result.inviteCode} label="Copiar código" />
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-600">Link de invitación:</p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={result.inviteUrl}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
          onFocus={(e) => e.target.select()}
        />
        <CopyButton text={result.inviteUrl} label="Copiar link" />
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href="/admin/tenants/new"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
        >
          Invitar otro
        </a>
        <a
          href="/admin/tenants"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Ver todos los tenants
        </a>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
