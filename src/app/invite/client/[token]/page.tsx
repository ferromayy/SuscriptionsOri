import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";
import { InviteCodeForm } from "@/components/invite/invite-code-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { getClientInvitationState } from "@/lib/invitations/get-invitation";
import { isInviteCodeVerified } from "@/lib/invitations/invite-verification-cookie";

export default async function ClientInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await getClientInvitationState(token);
  const currentUser = await getCurrentUser();
  const codeVerified = await isInviteCodeVerified(token);

  if (state.kind === "not_found") {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitación inválida</h1>
        <p className="mt-2 text-gray-600">
          El link no existe o fue revocado. Pedile al administrador un nuevo
          link y código.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-gray-600">
          ← Inicio
        </Link>
      </InviteShell>
    );
  }

  if (state.kind === "expired") {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitación expirada</h1>
        <p className="mt-2 text-gray-600">
          La invitación para <strong>{state.email}</strong> en{" "}
          <strong>{state.tenantName}</strong> venció.
        </p>
      </InviteShell>
    );
  }

  if (state.kind === "already_accepted") {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitación ya aceptada</h1>
        <p className="mt-2 text-gray-600">
          Esta invitación para <strong>{state.tenantName}</strong> ya fue usada.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/auth/login?next=/app/${state.tenantSlug}`}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Iniciar sesión
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (state.kind !== "valid") {
    return null;
  }

  const { invitation } = state;

  if (currentUser) {
    const role = await getTenantRole(currentUser.id, invitation.tenantId);
    if (isTenantManager(role)) {
      redirect(`/app/${invitation.tenant.slug}`);
    }
  }

  return (
    <InviteShell>
      <p className="text-sm font-medium uppercase tracking-widest text-gray-600">
        Invitación de cliente
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{invitation.tenant.name}</h1>

      {!codeVerified ? (
        <>
          <p className="mt-4 text-gray-600">
            Ingresá el código de 6 dígitos que te compartió el administrador.
          </p>
          <InviteCodeForm token={token} email={invitation.email} />
        </>
      ) : (
        <>
          <p className="mt-4 text-gray-600">
            Código verificado. Completá tus datos y elegí tu contraseña para
            activar la organización.
          </p>
          {currentUser && (
            <div className="mt-4 rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-800">
              <p>
                Estás logueado como <strong>{currentUser.email}</strong>. Para
                crear la cuenta del cliente ({invitation.email}), cerrá sesión o
                usá una ventana de incógnito.
              </p>
              <form action={logoutAction} className="mt-3">
                <button
                  type="submit"
                  className="text-sm font-medium text-gray-700 underline"
                >
                  Cerrar sesión y continuar
                </button>
              </form>
            </div>
          )}
          <AcceptInviteForm token={token} email={invitation.email} />
        </>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        {children}
      </div>
    </div>
  );
}
