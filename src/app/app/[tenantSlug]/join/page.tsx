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
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">Organización no encontrada</h1>
          <p className="ori-subtitle mt-4">
            El link no es válido. Verificá la URL con quien te invitó.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-gray-600">
            ← Inicio
          </Link>
        </div>
      </JoinShell>
    );
  }

  if (tenant.status !== "active") {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">{tenant.name}</h1>
          <p className="ori-subtitle mt-4">
            Esta organización aún no está activa. Volvé a intentar más tarde.
          </p>
        </div>
      </JoinShell>
    );
  }

  if (!tenant.allowPublicSignup) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">{tenant.name}</h1>
          <p className="ori-subtitle mt-4">
            El registro público está deshabilitado para esta organización.
          </p>
        </div>
      </JoinShell>
    );
  }

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    if (role === "subscriber") {
      redirect(`/app/${tenant.slug}`);
    }
    if (!isTenantManager(role)) {
      const { userHasPendingSubscription } = await import(
        "@/lib/subscribers/ensure-subscriber-membership"
      );
      if (await userHasPendingSubscription(currentUser.id, tenant.id)) {
        redirect(`/app/${tenant.slug}/pendiente`);
      }
    }
  }

  const plans = await getActivePlansForTenant(tenant.id);
  const mpConnection = await getTenantMpConnection(tenant.id);
  const paymentOptions = {
    // Mercado Pago card checkout temporarily disabled — transfer only.
    cardsEnabled: false,
    transferEnabled: Boolean(
      mpConnection?.transferAlias || mpConnection?.transferCbu,
    ),
    transferAlias: mpConnection?.transferAlias ?? null,
    transferCbu: mpConnection?.transferCbu ?? null,
    transferHolderName: mpConnection?.transferHolderName ?? null,
  };

  if (plans.length === 0) {
    return (
      <JoinShell>
        <div className="mx-auto max-w-md text-center">
          <h1 className="ori-title">{tenant.name}</h1>
          <p className="ori-subtitle mt-4">
            Todavía no hay suscripciones disponibles. Pedile al administrador
            que configure una en el panel.
          </p>
        </div>
      </JoinShell>
    );
  }

  let loggedInAsManager = false;

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    loggedInAsManager = isTenantManager(role);
  }

  return (
    <JoinShell>
      {isPreview && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
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
        <div className="mb-8 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
          <p>
            Estás logueado como administrador ({currentUser!.email}). Podés
            registrarte como suscriptor abajo con <strong>otro email</strong>.
          </p>
        </div>
      )}

      <div className="mx-auto max-w-2xl text-center">
        <h1 className="ori-title">
          Encontrá la suscripción que mejor va con vos
        </h1>
        <p className="ori-subtitle mx-auto mt-4 max-w-xl">
          Unite a {tenant.name}. Elegí tu plan, frecuencia y entrega — con
          trazabilidad y cuidado en cada envío.
        </p>
      </div>

      <div className="mx-auto mt-10 w-full max-w-xl">
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
      </div>
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ori-container py-12 sm:py-16">
      {children}
    </div>
  );
}
