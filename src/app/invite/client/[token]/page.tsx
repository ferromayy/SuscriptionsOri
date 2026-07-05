import Link from "next/link";
import { redirect } from "next/navigation";

import { AcceptInviteForm } from "@/components/invite/accept-invite-form";
import { AcceptInviteLoggedIn } from "@/components/invite/accept-invite-logged-in";
import { InviteCodeForm } from "@/components/invite/invite-code-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole } from "@/lib/auth/permissions";
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
        <p className="mt-2 text-slate-400">
          El link no existe o fue revocado. Pedile al administrador un nuevo
          link y código.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-slate-400">
          ← Inicio
        </Link>
      </InviteShell>
    );
  }

  if (state.kind === "expired") {
    return (
      <InviteShell>
        <h1 className="text-2xl font-semibold">Invitación expirada</h1>
        <p className="mt-2 text-slate-400">
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
        <p className="mt-2 text-slate-400">
          Esta invitación para <strong>{state.tenantName}</strong> ya fue usada.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/auth/login?next=/app/${state.tenantSlug}`}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950"
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
    if (role === "owner" || role === "admin") {
      redirect(`/app/${invitation.tenant.slug}`);
    }
  }

  return (
    <InviteShell>
      <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
        Invitación de cliente
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{invitation.tenant.name}</h1>

      {!codeVerified ? (
        <>
          <p className="mt-4 text-slate-400">
            Ingresá el código de 6 dígitos que te compartió el administrador.
          </p>
          <InviteCodeForm token={token} email={invitation.email} />
        </>
      ) : (
        <>
          <p className="mt-4 text-slate-400">
            Código verificado. Elegí tu contraseña para activar la organización.
          </p>
          {currentUser && currentUser.email === invitation.email ? (
            <AcceptInviteLoggedIn
              token={token}
              email={invitation.email}
              currentEmail={currentUser.email}
            />
          ) : (
            <>
              {currentUser && currentUser.email !== invitation.email && (
                <p className="mt-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
                  Estás logueado como <strong>{currentUser.email}</strong>. Creá
                  la cuenta del cliente abajo; al terminar se usará{" "}
                  <strong>{invitation.email}</strong>.
                </p>
              )}
              <AcceptInviteForm token={token} email={invitation.email} />
            </>
          )}
        </>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        {children}
      </div>
    </div>
  );
}
