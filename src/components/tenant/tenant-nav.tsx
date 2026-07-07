import Link from "next/link";

import { logoutAction } from "@/app/auth/actions";

type TenantNavProps = {
  tenantSlug: string;
  tenantName: string;
  isLoggedIn: boolean;
  isManager: boolean;
};

export function TenantNav({
  tenantSlug,
  tenantName,
  isLoggedIn,
  isManager,
}: TenantNavProps) {
  const base = `/app/${tenantSlug}`;

  return (
    <header className="ori-header">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div>
          <p className="ori-eyebrow">Portal</p>
          <Link href={base} className="text-lg font-semibold text-gray-900 hover:text-gray-600">
            {tenantName}
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-6">
          {isLoggedIn && (
            <>
              <Link href={base} className="ori-nav-link">
                Panel
              </Link>
              {isManager && (
                <Link href={`${base}/suscriptores`} className="ori-nav-link">
                  Suscriptores
                </Link>
              )}
              <Link href={`${base}/cuenta`} className="ori-nav-link">
                Mi cuenta
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="ori-nav-link">
                  Salir
                </button>
              </form>
            </>
          )}
          {!isLoggedIn && (
            <Link href="/" className="ori-nav-link">
              Subscriptions Ori
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
