import Link from "next/link";

import { getTenantJoinUrl } from "@/lib/tenants/join-url";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function TenantOnboardingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/onboarding`,
    requireManager: true,
    unauthorizedRedirect: "/",
  });

  const joinUrl = getTenantJoinUrl(tenant.slug);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="ori-eyebrow">Bienvenido</p>
      <h1 className="ori-title mt-2">{tenant.name}</h1>
      <p className="mt-4 text-gray-600">
        Tu cuenta está activa como <strong className="text-gray-800">owner</strong>.
        Compartí el link de abajo para que tus suscriptos se registren.
      </p>

      <div className="mt-8 ori-card">
        <p className="mt-2 text-sm text-gray-500">
          Link para suscriptos:
        </p>
        <p className="mt-1 font-mono text-sm text-gray-900">{joinUrl}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/app/${tenant.slug}/suscriptores`}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          Ir a Suscriptores
        </Link>
        <Link
          href={`/app/${tenant.slug}`}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700"
        >
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
