import { cache } from "react";

import { createDbClient } from "@/lib/db/client";
import { parseTenantSettings } from "@/lib/tenants/settings";

export type PublicTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  allowPublicSignup: boolean;
};

export const getTenantBySlug = cache(async function getTenantBySlug(
  slug: string,
): Promise<PublicTenant | null> {
  const db = createDbClient();
  const { data } = await db
    .from("tenants")
    .select("id, name, slug, status, settings")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const settings = parseTenantSettings(data.settings);

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    status: data.status,
    allowPublicSignup: settings.allow_public_signup,
  };
});
