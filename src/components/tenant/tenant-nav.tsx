import Image from "next/image";
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
    <>
      <div className="ori-announce" aria-hidden="true">
        <div className="ori-announce-track">
          <span>
            🎉 Café de especialidad · suscribite y recibí fresco a tu ritmo
          </span>
          <span>📦 Elegí tu plan, frecuencia y entrega en pocos pasos</span>
          <span>
            🎉 Café de especialidad · suscribite y recibí fresco a tu ritmo
          </span>
          <span>📦 Elegí tu plan, frecuencia y entrega en pocos pasos</span>
        </div>
      </div>

      <header className="ori-header sticky top-8 z-40">
        <div className="ori-container flex h-[4.75rem] items-center justify-between gap-6 sm:h-[5.25rem]">
          <Link
            href={base}
            className="flex h-full shrink-0 items-center py-2"
            aria-label={tenantName}
          >
            <Image
              src="/images/brand/logo.png"
              alt={tenantName}
              width={240}
              height={97}
              className="h-[3.25rem] w-auto object-contain object-left sm:h-16"
              priority
            />
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 sm:gap-x-7">
            {isLoggedIn && (
              <>
                <Link href={base} className="ori-nav-link">
                  Panel
                </Link>

                {isManager && (
                  <>
                    <span
                      className="hidden h-4 w-px bg-gray-200 sm:block"
                      aria-hidden
                    />
                    <Link href={`${base}/dashboard`} className="ori-nav-link">
                      Dashboard
                    </Link>
                    <Link
                      href={`${base}/suscripciones`}
                      className="ori-nav-link"
                    >
                      Suscripciones
                    </Link>
                    <Link
                      href={`${base}/suscriptores`}
                      className="ori-nav-link"
                    >
                      Suscriptores
                    </Link>
                    <span
                      className="hidden h-4 w-px bg-gray-200 sm:block"
                      aria-hidden
                    />
                  </>
                )}

                <Link href={`${base}/pagos`} className="ori-nav-link">
                  Pagos
                </Link>
                <Link href={`${base}/cuenta`} className="ori-nav-link">
                  Mi cuenta
                </Link>
                <form action={logoutAction} className="inline">
                  <input type="hidden" name="tenantSlug" value={tenantSlug} />
                  <button type="submit" className="ori-nav-link">
                    Salir
                  </button>
                </form>
              </>
            )}
            {!isLoggedIn && (
              <Link href={`/auth/login?next=${base}`} className="ori-nav-link">
                Ingresar
              </Link>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
