"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSubscriptionPlan } from "@/lib/plans/create-plan";
import { getCasaSubscriptionInput } from "@/lib/plans/seed-casa-plan";
import { getPlanByIdForTenant, tenantHasPlanNamed } from "@/lib/plans/get-plans";
import { createPlanSchema, type CreatePlanInput } from "@/lib/plans/schemas";
import {
  deleteSubscriptionPlan,
  updateSubscriptionPlan,
} from "@/lib/plans/update-plan";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export type SubscriptionActionState = {
  error: string | null;
};

function parsePlanPayload(
  formData: FormData,
): { error: string } | { data: CreatePlanInput } {
  const rawPayload = formData.get("payload");
  if (!rawPayload || typeof rawPayload !== "string") {
    return { error: "Datos incompletos" };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawPayload);
  } catch {
    return { error: "No se pudieron leer los datos del formulario" };
  }

  const parsed = createPlanSchema.safeParse(parsedPayload);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  return { data: parsed.data };
}

function revalidateSubscriptionPaths(tenantSlug: string) {
  revalidatePath(`/app/${tenantSlug}/suscripciones`);
  revalidatePath(`/app/${tenantSlug}/join`);
  revalidatePath(`/app/${tenantSlug}/suscriptores`);
  revalidatePath(`/app/${tenantSlug}`);
}

export async function createSubscriptionAction(
  tenantSlug: string,
  _prev: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones/nueva`,
    requireManager: true,
  });

  const parsed = parsePlanPayload(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const result = await createSubscriptionPlan(tenant.id, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidateSubscriptionPaths(tenantSlug);
  redirect(`/app/${tenantSlug}/suscripciones`);
}

export async function updateSubscriptionAction(
  tenantSlug: string,
  planId: string,
  _prev: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones/${planId}/editar`,
    requireManager: true,
  });

  const parsed = parsePlanPayload(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const result = await updateSubscriptionPlan(tenant.id, planId, parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidateSubscriptionPaths(tenantSlug);
  redirect(`/app/${tenantSlug}/suscripciones`);
}

export async function deleteSubscriptionAction(
  tenantSlug: string,
  planId: string,
): Promise<SubscriptionActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones`,
    requireManager: true,
  });

  const plan = await getPlanByIdForTenant(tenant.id, planId);
  if (!plan) {
    return { error: "Suscripción no encontrada" };
  }

  const result = await deleteSubscriptionPlan(tenant.id, planId);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidateSubscriptionPaths(tenantSlug);
  redirect(`/app/${tenantSlug}/suscripciones`);
}

export async function loadCasaExampleAction(
  tenantSlug: string,
): Promise<SubscriptionActionState> {
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones`,
    requireManager: true,
  });

  const example = getCasaSubscriptionInput();
  const exists = await tenantHasPlanNamed(tenant.id, example.name);
  if (exists) {
    return { error: "Ya existe una suscripción llamada «Suscripción casa»" };
  }

  const result = await createSubscriptionPlan(tenant.id, example);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidateSubscriptionPaths(tenantSlug);
  return { error: null };
}
