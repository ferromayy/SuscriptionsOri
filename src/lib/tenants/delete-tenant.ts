import { softDeleteTenantWithCleanup } from "@/lib/db/soft-delete";

export async function deleteTenantWithCleanup(
  tenantId: string,
): Promise<{ error: string | null }> {
  return softDeleteTenantWithCleanup(tenantId);
}
