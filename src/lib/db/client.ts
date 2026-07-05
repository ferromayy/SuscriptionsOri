import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createClient<Database>> | null = null;

export function createDbClient() {
  if (client) {
    return client;
  }

  const serviceRoleKey = getSupabaseServiceRoleKey();
  const { supabaseUrl } = getPublicEnv();

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY tiene una Publishable key (sb_publishable_...). " +
        "Necesitás la Secret key (sb_secret_...) en Supabase → Settings → API.",
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SECRET_KEY",
    ]
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Database not configured. Missing: ${missing}. ` +
        "Get SUPABASE_SECRET_KEY from Supabase → Settings → API → Secret key (sb_secret_...). " +
        "Do NOT use the Publishable key.",
    );
  }

  client = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}
