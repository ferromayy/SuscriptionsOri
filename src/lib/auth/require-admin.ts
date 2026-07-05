import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/types";

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!(await isPlatformAdmin(user.id))) {
    redirect("/admin/login?error=unauthorized");
  }

  return user;
}
