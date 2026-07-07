import { getAppUrl } from "@/lib/env";

export function getTenantJoinUrl(tenantSlug: string): string {
  return `${getAppUrl()}/app/${tenantSlug}/join`;
}
