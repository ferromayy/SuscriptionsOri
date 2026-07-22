import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export default async function TenantSubscriberLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  const resolvedSearch = await searchParams;
  const home = `/app/${tenantSlug}`;
  const defaultNext =
    resolvedSearch.next?.startsWith(home) ? resolvedSearch.next : home;

  if (!tenant || tenant.status !== "active") {
    return (
      <div className="ori-container py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">Organización no encontrada</h1>
          <p className="ori-subtitle mt-4">
            El link de acceso no es válido.
          </p>
        </div>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (user) {
    const role = await getTenantRole(user.id, tenant.id);
    if (role === "subscriber" || isTenantManager(role)) {
      redirect(home);
    }
    redirect(`${home}/pendiente`);
  }

  return (
    <div className="ori-container flex justify-center py-14 sm:py-20">
      <div className="w-full ori-form-shell">
        <p className="ori-section-label">{tenant.name}</p>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">
          Ingresar a mi suscripción
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Solo para suscriptores de {tenant.name} que ya tienen cuenta.
        </p>

        <LoginForm
          searchParams={searchParams}
          tenantSlug={tenant.slug}
          defaultNext={defaultNext}
          audience="subscriber"
        />

        <div className="mt-6 rounded-lg border border-gray-200 bg-white/50 px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-800">¿Todavía no te suscribiste?</p>
          <Link
            href={`${home}/join`}
            className="mt-2 inline-block font-medium text-gray-900 underline-offset-4 hover:underline"
          >
            Ir a suscripciones →
          </Link>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <p className="text-xs text-gray-500">
            ¿No llegó el email de verificación?
          </p>
          <div className="mt-2">
            <ResendVerificationForm />
          </div>
        </div>
      </div>
    </div>
  );
}
