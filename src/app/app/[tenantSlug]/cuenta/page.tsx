import { AccountSettings } from "@/components/account/account-settings";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { user, tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/cuenta`,
  });

  return (
    <div className="ori-container py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Mi cuenta</h1>
      <p className="ori-subtitle mt-4">
        Administrá tus datos, contraseña y cuenta.
      </p>

      <div className="mt-8">
        <AccountSettings
          tenantSlug={tenant.slug}
          email={user.email}
          fullName={user.fullName}
        />
      </div>
    </div>
  );
}
