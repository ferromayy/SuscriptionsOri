import { revalidatePath } from "next/cache";

export function revalidateAdmin(): void {
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
}
