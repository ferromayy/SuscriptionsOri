import Link from "next/link";

import { AdminPageWrapper } from "@/components/admin/admin-shell";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";

export default async function NewTenantPage() {
  return (
    <AdminPageWrapper
      title="Nuevo cliente"
      description="Creás el tenant y generás un link de invitación. El cliente crea su propia cuenta."
    >
      <CreateTenantForm />
    </AdminPageWrapper>
  );
}
