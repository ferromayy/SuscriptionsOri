import { TenantNav } from "@/components/tenant/tenant-nav";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getTenantBySlug } from "@/lib/tenants/get-tenant-by-slug";

export default async function TenantPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await getTenantBySlug(tenantSlug);
  const user = await getCurrentUser();

  let isManager = false;
  if (user && tenant) {
    const role = await getTenantRole(user.id, tenant.id);
    isManager = isTenantManager(role);
  }

  return (
    <div className="ori-portal">
      <TenantNav
        tenantSlug={tenantSlug}
        tenantName={tenant?.name ?? tenantSlug}
        isLoggedIn={Boolean(user)}
        isManager={isManager}
      />
      <main>{children}</main>
    </div>
  );
}
