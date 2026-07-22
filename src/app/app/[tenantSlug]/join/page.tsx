import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinExperience } from "@/components/join/join-experience";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { CARD_PAYMENTS_ENABLED } from "@/lib/payments/feature-flags";
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
      <JoinMessage>
        <h1 className="ori-title">Organización no encontrada</h1>
        <p className="ori-subtitle mt-4">
          El link no es válido. Verificá la URL con quien te invitó.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-gray-600">
          ← Inicio
        </Link>
      </JoinMessage>
    );
  }

  if (tenant.status !== "active") {
    return (
      <JoinMessage>
        <h1 className="ori-title">{tenant.name}</h1>
        <p className="ori-subtitle mt-4">
          Esta organización aún no está activa. Volvé a intentar más tarde.
        </p>
      </JoinMessage>
    );
  }

  if (!tenant.allowPublicSignup) {
    return (
      <JoinMessage>
        <h1 className="ori-title">{tenant.name}</h1>
        <p className="ori-subtitle mt-4">
          El registro público está deshabilitado para esta organización.
        </p>
      </JoinMessage>
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
    cardsEnabled: CARD_PAYMENTS_ENABLED && Boolean(mpConnection),
    transferEnabled: Boolean(
      mpConnection?.transferAlias || mpConnection?.transferCbu,
    ),
    transferAlias: mpConnection?.transferAlias ?? null,
    transferCbu: mpConnection?.transferCbu ?? null,
    transferHolderName: mpConnection?.transferHolderName ?? null,
  };

  if (plans.length === 0) {
    return (
      <JoinMessage>
        <h1 className="ori-title">{tenant.name}</h1>
        <p className="ori-subtitle mt-4">
          Todavía no hay experiencias disponibles. Pedile al administrador
          que configure una en el panel.
        </p>
      </JoinMessage>
    );
  }

  let loggedInAsManager = false;

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, tenant.id);
    loggedInAsManager = isTenantManager(role);
  }

  return (
    <JoinShell>
      {(isPreview || (loggedInAsManager && !isPreview)) && (
        <div className="ori-container pt-8">
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
            <div className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800">
              <p>
                Estás logueado como administrador ({currentUser!.email}). Podés
                registrarte como suscriptor abajo con{" "}
                <strong>otro email</strong>.
              </p>
            </div>
          )}
        </div>
      )}

      <JoinExperience
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        plans={plans}
        paymentOptions={paymentOptions}
        supportWhatsapp={
          tenant.supportWhatsapp ||
          process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim() ||
          null
        }
      />
    </JoinShell>
  );
}

function JoinShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-[#f6f6f4]">{children}</div>;
}

function JoinMessage({ children }: { children: React.ReactNode }) {
  return (
    <JoinShell>
      <div className="ori-container py-16 sm:py-20">
        <div className="mx-auto max-w-md text-center">{children}</div>
      </div>
    </JoinShell>
  );
}
