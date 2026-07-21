import { redirect } from "next/navigation";

export default async function NuevoSubscriberRedirect({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/app/${tenantSlug}/suscriptores/suscribir`);
}
