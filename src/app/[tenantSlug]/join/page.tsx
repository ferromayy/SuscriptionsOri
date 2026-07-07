import { redirect } from "next/navigation";

export default async function LegacyJoinRedirect({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/app/${tenantSlug}/join`);
}
