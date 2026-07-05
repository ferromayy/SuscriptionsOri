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
        <label htmlFor="name" className="block text-sm text-slate-300">
          Nombre de la organización
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="Ej: Acme Corp"
          onChange={(e) => {
            if (!slugTouched) {
              setSlug(slugifyName(e.target.value));
            }
          }}
        />
        {state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-400">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm text-slate-300">
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
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="acme-corp"
        />
        <p className="mt-1 text-xs text-slate-500">
          Portal futuro del cliente: /{slug || "slug"}/join
        </p>
        {state.fieldErrors?.slug && (
          <p className="mt-1 text-sm text-red-400">{state.fieldErrors.slug[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="ownerEmail" className="block text-sm text-slate-300">
          Email del cliente (owner)
        </label>
        <input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:border-slate-500"
          placeholder="cliente@empresa.com"
        />
        <p className="mt-1 text-xs text-slate-500">
          Debe usar este email al registrarse con el link de invitación.
        </p>
        {state.fieldErrors?.ownerEmail && (
          <p className="mt-1 text-sm text-red-400">
            {state.fieldErrors.ownerEmail[0]}
          </p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-white px-4 py-2 font-medium text-slate-950 disabled:opacity-60"
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
    <div className="max-w-xl rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-6">
      <h2 className="text-lg font-semibold text-emerald-100">
        Tenant creado — compartí la invitación
      </h2>
      <p className="mt-2 text-sm text-slate-300">
        <strong>{result.tenantName}</strong> ({result.tenantSlug}) — enviá el
        link y el código a <strong>{result.ownerEmail}</strong>. El cliente abre
        el link, ingresa el código y elige su contraseña.
      </p>
      <p className="mt-1 text-xs text-slate-500">La invitación expira: {expires}</p>

      <div className="mt-6 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-amber-200/80">
          Código de verificación
        </p>
        <div className="mt-2 flex items-center gap-2">
          <p className="flex-1 text-center text-3xl font-bold tracking-[0.35em] text-amber-50">
            {result.inviteCode}
          </p>
          <CopyButton text={result.inviteCode} label="Copiar código" />
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-400">Link de invitación:</p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={result.inviteUrl}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          onFocus={(e) => e.target.select()}
        />
        <CopyButton text={result.inviteUrl} label="Copiar link" />
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href="/admin/tenants/new"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
        >
          Invitar otro
        </a>
        <a
          href="/admin/tenants"
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950"
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
      className="shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
