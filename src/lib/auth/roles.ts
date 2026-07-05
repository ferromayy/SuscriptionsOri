import { getSuperAdminEmails } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function isPlatformAdmin(userId: string, email?: string | null) {
  const allowlist = getSuperAdminEmails();
  if (email && allowlist.includes(email.toLowerCase())) {
    return true;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}
