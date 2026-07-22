import { createDbClient } from "@/lib/db/client";
import { isTenantManager } from "@/lib/auth/permissions";
import type { TenantMemberRole } from "@/types/database";

export type PostLoginAudience = "subscriber" | "manager" | "auto";

export type PostLoginOptions = {
  /** When set, keep the user inside this tenant's portal. */
  tenantSlug?: string | null;
  audience?: PostLoginAudience;
};

const MANAGER_ONLY_SEGMENTS = [
  "dashboard",
  "suscripciones",
  "suscriptores",
  "onboarding",
] as const;

export function isManagerOnlyAppPath(pathname: string, tenantSlug: string): boolean {
  const base = `/app/${tenantSlug}`;
  if (pathname === base || pathname === `${base}/`) return false;
  return MANAGER_ONLY_SEGMENTS.some((segment) => {
    const prefix = `${base}/${segment}`;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function sanitizeSubscriberNext(
  requestedNext: string,
  tenantSlug: string,
): string {
  const home = `/app/${tenantSlug}`;
  const next = requestedNext.startsWith("/") ? requestedNext : home;

  if (!next.startsWith(`${home}/`) && next !== home) {
    return home;
  }
  if (isManagerOnlyAppPath(next, tenantSlug)) {
    return home;
  }
  return next;
}

export async function resolvePostLoginRedirect(
  userId: string,
  requestedNext: string,
  options: PostLoginOptions = {},
): Promise<string> {
  const audience = options.audience ?? "auto";
  const tenantSlug = options.tenantSlug?.trim() || null;
  const next = requestedNext.startsWith("/") ? requestedNext : "/";

  if (audience === "subscriber" && tenantSlug) {
    return resolveSubscriberLoginRedirect(userId, next, tenantSlug);
  }

  if (tenantSlug && next.startsWith(`/app/${tenantSlug}`)) {
    if (audience === "manager" && isManagerOnlyAppPath(next, tenantSlug)) {
      return next;
    }
    if (audience !== "manager") {
      return sanitizeSubscriberNext(next, tenantSlug);
    }
    return next;
  }

  if (next !== "/") {
    // Never dump subscribers onto the platform home from a tenant deep link.
    const match = next.match(/^\/app\/([^/]+)/);
    if (match?.[1]) {
      return sanitizeSubscriberNext(next, match[1]);
    }
    return next;
  }

  const db = createDbClient();
  const { data: memberships } = await db
    .from("tenant_members")
    .select("role, tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (memberships?.length) {
    const preferred =
      audience === "subscriber"
        ? (memberships.find((m) => m.role === "subscriber") ?? memberships[0])
        : (memberships.find((membership) =>
            isTenantManager(membership.role as TenantMemberRole),
          ) ?? memberships[0]);

    const { data: tenant } = await db
      .from("tenants")
      .select("slug")
      .eq("id", preferred.tenant_id)
      .maybeSingle();

    if (tenant) {
      return `/app/${tenant.slug}`;
    }
  }

  const { data: pendingSub } = await db
    .from("subscriptions")
    .select("tenant_id")
    .eq("user_id", userId)
    .in("status", ["pending_payment", "pending_authorization"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingSub) {
    const { data: tenant } = await db
      .from("tenants")
      .select("slug")
      .eq("id", pendingSub.tenant_id)
      .maybeSingle();
    if (tenant) {
      return `/app/${tenant.slug}/pendiente`;
    }
  }

  // Platform home is for org/admin entry — never a subscriber fallback.
  return audience === "subscriber" ? "/join" : "/";
}

async function resolveSubscriberLoginRedirect(
  userId: string,
  requestedNext: string,
  tenantSlug: string,
): Promise<string> {
  const db = createDbClient();
  const home = `/app/${tenantSlug}`;
  const safeNext = sanitizeSubscriberNext(requestedNext, tenantSlug);

  const { data: tenant } = await db
    .from("tenants")
    .select("id, slug, status")
    .eq("slug", tenantSlug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant || tenant.status !== "active") {
    return "/join";
  }

  const { data: membership } = await db
    .from("tenant_members")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenant.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (membership) {
    if (isTenantManager(membership.role as TenantMemberRole)) {
      // Managers should use the organization login; keep them inside the tenant.
      return home;
    }
    return safeNext;
  }

  const { data: pendingSub } = await db
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenant.id)
    .in("status", ["pending_payment", "pending_authorization"])
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (pendingSub) {
    return `${home}/pendiente`;
  }

  return `${home}/join`;
}
