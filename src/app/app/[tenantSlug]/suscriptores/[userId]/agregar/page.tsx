import Link from "next/link";
import { notFound } from "next/navigation";

import { ManageSubscriptionForm } from "@/components/subscriptions/manage-subscription-form";
import { createDbClient } from "@/lib/db/client";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getSubscriberPlanIds } from "@/lib/subscribers/get-subscription-for-edit";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function AddSubscriptionForSubscriberPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; userId: string }>;
}) {
  const { tenantSlug, userId } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/${userId}/agregar`,
    requireManager: true,
  });

  const db = createDbClient();

  const { data: member } = await db
    .from("tenant_members")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .eq("role", "subscriber")
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) {
    notFound();
  }

  const { data: user } = await db
    .from("users")
    .select("id, email, full_name")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    notFound();
  }

  const { data: latestSub } = await db
    .from("subscriptions")
    .select(
      "contact_email, contact_phone, contact_first_name, contact_last_name",
    )
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const allPlans = await getActivePlansForTenant(tenant.id);
  const ownedPlanIds = new Set(await getSubscriberPlanIds(userId, tenant.id));
  const availablePlans = allPlans.filter((plan) => !ownedPlanIds.has(plan.id));
  const mpConnection = await getTenantMpConnection(tenant.id);

  const nameParts = (user.full_name ?? "").trim().split(/\s+/);
  const initialContact = {
    email: latestSub?.contact_email || user.email,
    phone: latestSub?.contact_phone || "",
    firstName: latestSub?.contact_first_name || nameParts[0] || "",
    lastName:
      latestSub?.contact_last_name || nameParts.slice(1).join(" ") || "",
  };

  return (
    <div className="ori-container py-16">
      <Link
        href={`/app/${tenant.slug}/suscriptores/${userId}`}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a la ficha
      </Link>

      <p className="ori-eyebrow mt-6">{tenant.name}</p>
      <h1 className="ori-title mt-2">Agregar suscripción</h1>
      <p className="ori-subtitle mt-4">
        Mismos pasos que haría {user.full_name || user.email}. La transferencia
        se confirma al instante. No se usa ni cambia la contraseña.
      </p>

      {availablePlans.length === 0 ? (
        <div className="mt-8 ori-card">
          <p className="text-sm text-gray-600">
            Esta persona ya tiene todos los planes disponibles, o no hay planes
            activos.
          </p>
        </div>
      ) : (
        <ManageSubscriptionForm
          tenantSlug={tenant.slug}
          plans={availablePlans}
          mode="add"
          submitLabel="Agregar suscripción"
          actingAsUserId={userId}
          initialContact={initialContact}
          paymentOptions={{
            cardsEnabled: false,
            transferEnabled: Boolean(
              mpConnection?.transferAlias || mpConnection?.transferCbu,
            ),
            transferAlias: mpConnection?.transferAlias ?? null,
            transferCbu: mpConnection?.transferCbu ?? null,
            transferHolderName: mpConnection?.transferHolderName ?? null,
          }}
        />
      )}
    </div>
  );
}
