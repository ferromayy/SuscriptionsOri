import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinForm } from "@/components/join/join-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export default async function TenantJoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { tenantSlug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "1";
  const tenant = await getTenantBySlug(tenantSlug);
  const currentUser = await getCurrentUser();

  if (!tenant) {
    return (
      <JoinShell>
        <h1 className="text-2xl font-semibold">Organización no encontrada</h1>
        <p className="mt-2 text-gray-600">
          El link no es válido. Verificá la URL con quien te invitó.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-gray-600">
          ← Inicio
        </Link>
      </JoinShell>
    );
  }

  if (tenant.status !== "active") {
    return (
      <JoinShell tenantName={tenant.name}>
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="mt-2 text-gray-600">
          Esta organización aún no está activa. Volvé a intentar más tarde.
        </p>
      </JoinShell>
    );
  }

  if (!tenant.allowPublicSignup) {
    return (
      <JoinShell tenantName={tenant.name}>
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="mt-2 text-gray-600">
          El registro público está deshabilitado para esta organización.
        </p>
      </JoinShell>
    );
  }

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    if (role === "subscriber") {
      redirect(`/app/${tenant.slug}`);
    }
  }

  const plans = await getActivePlansForTenant(tenant.id);
  const mpConnection = await getTenantMpConnection(tenant.id);
  const paymentOptions = {
    cardsEnabled: Boolean(mpConnection),
    transferEnabled: Boolean(
      mpConnection?.transferAlias || mpConnection?.transferCbu,
    ),
    transferAlias: mpConnection?.transferAlias ?? null,
    transferCbu: mpConnection?.transferCbu ?? null,
    transferHolderName: mpConnection?.transferHolderName ?? null,
  };

  if (plans.length === 0) {
    return (
      <JoinShell tenantName={tenant.name}>
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="mt-2 text-gray-600">
          Todavía no hay suscripciones disponibles. Pedile al administrador que
          configure una en el panel.
        </p>
      </JoinShell>
    );
  }

  let loggedInAsManager = false;

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    loggedInAsManager = isTenantManager(role);
  }

  return (
    <JoinShell tenantName={tenant.name}>
      {isPreview && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="font-medium">Vista previa del formulario público</p>
          <p className="mt-1 text-blue-800">
            Así lo ven tus suscriptos cuando abren el link público.
          </p>
          <Link
            href={`/app/${tenant.slug}/suscriptores`}
            className="mt-2 inline-block text-sm font-medium text-blue-700 underline"
          >
            ← Volver a Suscriptores
          </Link>
        </div>
      )}
      {loggedInAsManager && !isPreview && (
        <div className="mb-6 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          <p>
            Estás logueado como administrador ({currentUser!.email}). Podés
            registrarte como suscriptor abajo con <strong>otro email</strong>.
          </p>
        </div>
      )}
      <p className="text-sm font-medium uppercase tracking-widest text-gray-900">
        Crear cuenta
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Unite a {tenant.name}</h1>
      <p className="mt-4 text-gray-600">
        Elegí una suscripción y completá contacto, entrega y pago para crear tu
        cuenta.
      </p>
      <JoinForm
        tenantSlug={tenant.slug}
        plans={plans}
        paymentOptions={paymentOptions}
      />
      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Ya tenés cuenta?{" "}
        <Link
          href={`/auth/login?next=/app/${tenant.slug}/join`}
          className="text-gray-700 hover:text-gray-600"
        >
          Iniciar sesión
        </Link>
      </p>
    </JoinShell>
  );
}

function JoinShell({
  children,
  tenantName,
}: {
  children: React.ReactNode;
  tenantName?: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        {tenantName && (
          <p className="mb-4 text-xs uppercase tracking-widest text-gray-500">
            {tenantName}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
