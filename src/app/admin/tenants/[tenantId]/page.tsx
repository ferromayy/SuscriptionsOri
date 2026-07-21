import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageWrapper } from "@/components/admin/admin-shell";
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge";
import { createDbClient } from "@/lib/db/client";

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const db = createDbClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, slug, status, settings, created_at, updated_at")
    .eq("id", tenantId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tenant) {
    notFound();
  }

  const { data: members } = await db
    .from("tenant_members")
    .select("id, role, status, joined_via, created_at, user_id")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const usersById = new Map<
    string,
    {
      email: string;
      fullName: string | null;
      emailVerifiedAt: string | null;
      createdAt: string;
    }
  >();

  if (userIds.length > 0) {
    // Never select password_hash — only contact / identity fields.
    const { data: users } = await db
      .from("users")
      .select("id, email, full_name, email_verified_at, created_at")
      .in("id", userIds)
      .is("deleted_at", null);

    for (const user of users ?? []) {
      usersById.set(user.id, {
        email: user.email,
        fullName: user.full_name,
        emailVerifiedAt: user.email_verified_at,
        createdAt: user.created_at,
      });
    }
  }

  const { data: invitations } = await db
    .from("platform_invitations")
    .select("email, status, expires_at, created_at")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: mpConnection } = await db
    .from("tenant_mp_connections")
    .select(
      "status, mp_user_id, live_mode, transfer_cbu, transfer_alias, transfer_holder_name, connected_at",
    )
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .maybeSingle();

  const managers = (members ?? []).filter(
    (m) => m.role === "owner" || m.role === "admin",
  );
  const subscribers = (members ?? []).filter((m) => m.role === "subscriber");

  return (
    <AdminPageWrapper
      title={tenant.name}
      description={`Contacto y miembros de ${tenant.slug} (sin contraseñas).`}
    >
      <div className="mb-6">
        <Link
          href="/admin/tenants"
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Volver a tenants
        </Link>
      </div>

      <section className="ori-card space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Organización</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Nombre</dt>
            <dd className="font-medium text-gray-900">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Slug</dt>
            <dd className="font-mono text-gray-900">{tenant.slug}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Estado</dt>
            <dd className="mt-1">
              <TenantStatusBadge status={tenant.status} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Creado</dt>
            <dd className="text-gray-900">
              {new Date(tenant.created_at).toLocaleString("es-AR")}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Registro público</dt>
            <dd className="text-gray-900">
              {(tenant.settings as { allow_public_signup?: boolean } | null)
                ?.allow_public_signup === false
                ? "Deshabilitado"
                : "Habilitado"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Panel del cliente</dt>
            <dd>
              <Link
                href={`/app/${tenant.slug}`}
                className="text-gray-900 underline"
              >
                /app/{tenant.slug}
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">
          Dueños / admins ({managers.length})
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Datos de contacto de quien administra el tenant.
        </p>
        {managers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Todavía no hay dueño activo.</p>
        ) : (
          <MemberTable members={managers} usersById={usersById} />
        )}
      </section>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">
          Suscriptores ({subscribers.length})
        </h2>
        {subscribers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Sin suscriptores.</p>
        ) : (
          <MemberTable members={subscribers} usersById={usersById} />
        )}
      </section>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">Invitaciones</h2>
        {(invitations ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">Sin invitaciones.</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {(invitations ?? []).map((invite, index) => (
              <li
                key={`${invite.email}-${invite.created_at}-${index}`}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-gray-900">{invite.email}</span>
                <span className="text-gray-600">
                  {invite.status} · expira{" "}
                  {new Date(invite.expires_at).toLocaleDateString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">
          Datos de transferencia / MP
        </h2>
        {!mpConnection ? (
          <p className="mt-4 text-sm text-gray-600">
            Sin conexión de Mercado Pago ni datos de transferencia.
          </p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Estado MP</dt>
              <dd className="text-gray-900">{mpConnection.status}</dd>
            </div>
            <div>
              <dt className="text-gray-500">MP user id</dt>
              <dd className="font-mono text-gray-900">
                {mpConnection.mp_user_id ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Titular transferencia</dt>
              <dd className="text-gray-900">
                {mpConnection.transfer_holder_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Alias</dt>
              <dd className="text-gray-900">
                {mpConnection.transfer_alias ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">CBU/CVU</dt>
              <dd className="font-mono text-gray-900">
                {mpConnection.transfer_cbu ?? "—"}
              </dd>
            </div>
          </dl>
        )}
      </section>
    </AdminPageWrapper>
  );
}

function MemberTable({
  members,
  usersById,
}: {
  members: Array<{
    id: string;
    role: string;
    status: string;
    joined_via: string;
    created_at: string;
    user_id: string;
  }>;
  usersById: Map<
    string,
    {
      email: string;
      fullName: string | null;
      emailVerifiedAt: string | null;
      createdAt: string;
    }
  >;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3 font-medium">Nombre</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Rol</th>
            <th className="px-4 py-3 font-medium">Email verificado</th>
            <th className="px-4 py-3 font-medium">Alta</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const user = usersById.get(member.user_id);
            return (
              <tr
                key={member.id}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {user?.fullName ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-900">
                  {user?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-600">{member.role}</td>
                <td className="px-4 py-3 text-gray-600">
                  {user?.emailVerifiedAt
                    ? new Date(user.emailVerifiedAt).toLocaleDateString("es-AR")
                    : "No"}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(member.created_at).toLocaleDateString("es-AR")}
                  <span className="block text-xs text-gray-500">
                    {member.joined_via}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
