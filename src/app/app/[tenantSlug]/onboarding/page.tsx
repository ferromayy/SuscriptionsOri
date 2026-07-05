import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { createDbClient } from "@/lib/db/client";
import { getAppUrl } from "@/lib/env";

export default async function TenantOnboardingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/auth/login?next=/app/${tenantSlug}/onboarding`);
  }

  const db = createDbClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, slug, status")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (!tenant) {
    redirect("/");
  }

  const role = await getTenantRole(user.id, tenant.id);
  if (!role || !isTenantManager(role)) {
    redirect("/");
  }

  const joinUrl = `${getAppUrl()}/${tenant.slug}/join`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
        Bienvenido
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{tenant.name}</h1>
      <p className="mt-4 text-slate-400">
        Tu cuenta está activa como <strong className="text-slate-200">owner</strong>.
        En la Fase 3 tus suscriptos podrán registrarse en el portal público.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-sm text-slate-400">Link para suscriptos (próximamente)</p>
        <p className="mt-2 font-mono text-sm text-emerald-300">{joinUrl}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/app/${tenant.slug}`}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950"
        >
          Ir al panel
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
