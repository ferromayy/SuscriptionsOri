import Link from "next/link";

import { JoinForm } from "@/components/join/join-form";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function ManagerSubscribePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/suscribir`,
    requireManager: true,
  });

  const plans = await getActivePlansForTenant(tenant.id);
  const mpConnection = await getTenantMpConnection(tenant.id);
  const paymentOptions = {
    cardsEnabled: false,
    transferEnabled: Boolean(
      mpConnection?.transferAlias || mpConnection?.transferCbu,
    ),
    transferAlias: mpConnection?.transferAlias ?? null,
    transferCbu: mpConnection?.transferCbu ?? null,
    transferHolderName: mpConnection?.transferHolderName ?? null,
  };

  return (
    <div className="ori-container py-16">
      <Link
        href={`/app/${tenant.slug}/suscriptores`}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a suscriptores
      </Link>

      <p className="ori-eyebrow mt-6">{tenant.name}</p>
      <h1 className="ori-title mt-2">Suscribir</h1>
      <p className="ori-subtitle mt-4">
        Mismos pasos que el formulario público. Si ya tiene cuenta, no hace falta
        la contraseña. Si es cuenta nueva, definís una para que pueda entrar
        después (no se puede cambiar desde acá). Transferencia = activa al
        instante.
      </p>

      {plans.length === 0 ? (
        <div className="mt-8 ori-card">
          <p className="text-sm text-gray-600">
            Primero creá al menos un plan activo.
          </p>
          <Link
            href={`/app/${tenant.slug}/suscripciones`}
            className="mt-3 inline-block text-sm font-medium text-gray-900 underline"
          >
            Ir a suscripciones
          </Link>
        </div>
      ) : (
        <JoinForm
          tenantSlug={tenant.slug}
          plans={plans}
          paymentOptions={paymentOptions}
          variant="manager"
        />
      )}
    </div>
  );
}
