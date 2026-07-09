import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";
import {
  getTenantBySlug,
  type PublicTenant,
} from "@/lib/tenants/get-tenant-by-slug";
import type { TenantMemberRole } from "@/types/database";

type RequireTenantAccessOptions = {
  nextPath: string;
  requireManager?: boolean;
  unauthorizedRedirect?: string;
};

export type TenantAccess = {
  user: SessionUser;
  tenant: PublicTenant;
  role: TenantMemberRole;
};

function tenantPortalBlocked(status: string): boolean {
  return status !== "active";
}

export function tenantUnavailablePath(slug: string): string {
  return `/app/${slug}/unavailable`;
}

export async function requireTenantAccess(
  tenantSlug: string,
  options: RequireTenantAccessOptions,
): Promise<TenantAccess> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(options.nextPath)}`);
  }

  const tenant = await getTenantBySlug(tenantSlug);

  if (!tenant) {
    redirect("/");
  }

  if (tenantPortalBlocked(tenant.status)) {
    redirect(tenantUnavailablePath(tenant.slug));
  }

  const role = await getTenantRole(user.id, tenant.id);

  if (!role) {
    redirect(options.unauthorizedRedirect ?? "/");
  }

  if (options.requireManager && !isTenantManager(role)) {
    redirect(options.unauthorizedRedirect ?? `/app/${tenant.slug}`);
  }

  return { user, tenant, role };
}
