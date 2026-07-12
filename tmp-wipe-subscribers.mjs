import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY en el entorno");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = !process.argv.includes("--confirm");

async function main() {
  const { data: subscriberMembers, error: membersError } = await db
    .from("tenant_members")
    .select("id, tenant_id, user_id, status, deleted_at, tenants(name, slug)")
    .eq("role", "subscriber");

  if (membersError) {
    console.error("Error leyendo tenant_members:", membersError.message);
    process.exit(1);
  }

  const memberRows = subscriberMembers ?? [];
  const subscriberUserIds = [...new Set(memberRows.map((m) => m.user_id))];

  console.log(`Encontrados ${memberRows.length} registros de tenant_members con role=subscriber`);
  console.log(`Usuarios suscriptores únicos: ${subscriberUserIds.length}`);

  const byTenant = {};
  for (const m of memberRows) {
    const slug = m.tenants?.slug ?? m.tenant_id;
    byTenant[slug] = (byTenant[slug] ?? 0) + 1;
  }
  console.log("Por tenant:", byTenant);

  if (subscriberUserIds.length === 0) {
    console.log("Nada para borrar.");
    return;
  }

  const { data: allMemberships, error: allMembershipsError } = await db
    .from("tenant_members")
    .select("user_id, role, tenant_id")
    .in("user_id", subscriberUserIds);

  if (allMembershipsError) {
    console.error("Error leyendo membresías:", allMembershipsError.message);
    process.exit(1);
  }

  const nonSubscriberRoleUserIds = new Set(
    (allMemberships ?? [])
      .filter((m) => m.role !== "subscriber")
      .map((m) => m.user_id),
  );

  const { data: admins } = await db
    .from("platform_admins")
    .select("user_id")
    .in("user_id", subscriberUserIds);
  const platformAdminIds = new Set((admins ?? []).map((a) => a.user_id));

  const fullyDeletableUserIds = subscriberUserIds.filter(
    (id) => !nonSubscriberRoleUserIds.has(id) && !platformAdminIds.has(id),
  );
  const partialUserIds = subscriberUserIds.filter(
    (id) => nonSubscriberRoleUserIds.has(id) || platformAdminIds.has(id),
  );

  console.log(
    `Usuarios que se pueden borrar por completo (solo eran suscriptores): ${fullyDeletableUserIds.length}`,
  );
  console.log(
    `Usuarios que tienen otro rol también (owner/admin) o son platform_admin, se les quita solo la suscripción: ${partialUserIds.length}`,
  );

  const { count: subsCount } = await db
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .in("user_id", subscriberUserIds);
  console.log(`Filas en subscriptions afectadas: ${subsCount ?? 0}`);

  if (DRY_RUN) {
    console.log("\n(DRY RUN: no se borró nada. Volvé a correr con --confirm para ejecutar)");
    return;
  }

  console.log("\nEjecutando borrado...");

  if (fullyDeletableUserIds.length > 0) {
    const { error } = await db.from("users").delete().in("id", fullyDeletableUserIds);
    if (error) {
      console.error("Error borrando usuarios suscriptores:", error.message);
    } else {
      console.log(`✔ Borrados ${fullyDeletableUserIds.length} usuarios (con cascada).`);
    }
  }

  if (partialUserIds.length > 0) {
    const partialMemberRowIds = memberRows
      .filter((m) => partialUserIds.includes(m.user_id))
      .map((m) => m.id);

    const { error: subsDelError } = await db
      .from("subscriptions")
      .delete()
      .in("user_id", partialUserIds);
    if (subsDelError) {
      console.error("Error borrando subscriptions parciales:", subsDelError.message);
    }

    const { error: memberDelError } = await db
      .from("tenant_members")
      .delete()
      .in("id", partialMemberRowIds);
    if (memberDelError) {
      console.error("Error borrando tenant_members parciales:", memberDelError.message);
    } else {
      console.log(
        `✔ Quitada la membresía de suscriptor de ${partialUserIds.length} usuarios (conservando su otro rol).`,
      );
    }
  }

  console.log("\nListo.");
}

main();
