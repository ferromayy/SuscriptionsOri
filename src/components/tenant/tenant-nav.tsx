"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { logoutAction } from "@/app/auth/actions";

const ORI_SITE = "https://www.oricafe.com.ar";

type TenantNavProps = {
  tenantSlug: string;
  tenantName: string;
  isLoggedIn: boolean;
  isManager: boolean;
};

type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export function TenantNav({
  tenantSlug,
  tenantName,
  isLoggedIn,
  isManager,
}: TenantNavProps) {
  const base = `/app/${tenantSlug}`;
  const pathname = usePathname();
  const onJoin = pathname.includes("/join");
  const onLogin = pathname.includes("/login");

  // Admin/ops chrome for managers — except on public join/login, where they
  // should see the same public subscriber navbar as customers.
  if (isManager && !onJoin && !onLogin) {
    return (
      <ManagerNav
        tenantSlug={tenantSlug}
        tenantName={tenantName}
        base={base}
        isLoggedIn={isLoggedIn}
      />
    );
  }

  return (
    <SubscriberSiteNav
      tenantSlug={tenantSlug}
      tenantName={tenantName}
      base={base}
      isLoggedIn={isLoggedIn && !isManager}
    />
  );
}

function AnnounceBar() {
  return (
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
  );
}

function BrandLogo({
  href,
  tenantName,
}: {
  href: string;
  tenantName: string;
}) {
  const image = (
    <Image
      src="/images/brand/logo.png"
      alt={tenantName}
      width={240}
      height={97}
      className="h-[3.25rem] w-auto object-contain object-left sm:h-16"
      priority
    />
  );

  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        className="flex h-full shrink-0 items-center py-2"
        aria-label={tenantName}
      >
        {image}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className="flex h-full shrink-0 items-center py-2"
      aria-label={tenantName}
    >
      {image}
    </Link>
  );
}

/** Public join: Orí landing links. Logged-in subscriber: store CTA + account. */
function SubscriberSiteNav({
  tenantSlug,
  tenantName,
  base,
  isLoggedIn,
}: {
  tenantSlug: string;
  tenantName: string;
  base: string;
  isLoggedIn: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const marketingLinks: NavItem[] = [
    { label: "Inicio", href: `${ORI_SITE}/`, external: true },
    { label: "Café", href: `${ORI_SITE}/cafe`, external: true },
    { label: "Educación", href: `${ORI_SITE}/educacion`, external: true },
    { label: "Suscripciones", href: `${base}/join` },
    {
      label: "Mayoristas y asesoramiento",
      href: `${ORI_SITE}/mayoristas`,
      external: true,
    },
    { label: "Nosotros", href: `${ORI_SITE}/nosotros`, external: true },
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const joinActive =
    pathname === `${base}/join` || pathname.startsWith(`${base}/join/`);

  // Account area: keep chrome light — one bridge back to the online store.
  if (isLoggedIn) {
    return (
      <>
        <AnnounceBar />
        <header className="ori-header sticky top-8 z-40">
          <div className="ori-container flex h-[4.75rem] items-center justify-between gap-4 sm:h-[5.25rem]">
            <BrandLogo href={base} tenantName={tenantName} />

            <div className="flex items-center gap-3 sm:gap-5">
              <a
                href={`${ORI_SITE}/`}
                className="hidden rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-400 sm:inline-flex"
              >
                Ir a tienda online
              </a>

              <nav
                className="hidden items-center gap-x-5 sm:flex"
                aria-label="Mi cuenta"
              >
                <SubscriberActions
                  base={base}
                  tenantSlug={tenantSlug}
                  isLoggedIn
                />
              </nav>

              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-900 transition hover:bg-gray-50 sm:hidden"
                aria-expanded={menuOpen}
                aria-controls="ori-account-mobile-nav"
                aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div
              id="ori-account-mobile-nav"
              className="border-t border-gray-100 bg-white sm:hidden"
            >
              <div className="ori-container flex flex-col gap-1 py-4">
                <a
                  href={`${ORI_SITE}/`}
                  className="rounded-lg px-3 py-3 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                >
                  Ir a tienda online
                </a>
                <div className="my-2 h-px bg-gray-100" />
                <SubscriberActions
                  base={base}
                  tenantSlug={tenantSlug}
                  isLoggedIn
                  mobile
                />
              </div>
            </div>
          )}
        </header>
      </>
    );
  }

  return (
    <>
      <AnnounceBar />
      <header className="ori-header sticky top-8 z-40">
        <div className="ori-container flex h-[4.75rem] items-center justify-between gap-4 sm:h-[5.25rem]">
          <BrandLogo href={`${ORI_SITE}/`} tenantName={tenantName} />

          <nav
            className="hidden items-center gap-5 lg:flex xl:gap-7"
            aria-label="Sitio Orí"
          >
            {marketingLinks.map((item) => (
              <SiteNavLink
                key={item.href}
                item={item}
                active={item.href === `${base}/join` ? joinActive : false}
              />
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden items-center gap-x-5 lg:flex">
              <SubscriberActions
                base={base}
                tenantSlug={tenantSlug}
                isLoggedIn={false}
              />
            </div>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-900 transition hover:bg-gray-50 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="ori-subscriber-mobile-nav"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="ori-subscriber-mobile-nav"
            className="border-t border-gray-100 bg-white lg:hidden"
          >
            <div className="ori-container flex flex-col gap-1 py-4">
              {marketingLinks.map((item) => (
                <SiteNavLink
                  key={item.href}
                  item={item}
                  active={item.href === `${base}/join` ? joinActive : false}
                  mobile
                />
              ))}
              <div className="my-3 h-px bg-gray-100" />
              <SubscriberActions
                base={base}
                tenantSlug={tenantSlug}
                isLoggedIn={false}
                mobile
              />
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function SubscriberActions({
  base,
  tenantSlug,
  isLoggedIn,
  mobile = false,
}: {
  base: string;
  tenantSlug: string;
  isLoggedIn: boolean;
  mobile?: boolean;
}) {
  const linkClass = mobile
    ? "rounded-lg px-3 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    : "ori-nav-link";

  if (!isLoggedIn) {
    return (
      <Link href={`/app/${tenantSlug}/login`} className={linkClass}>
        Ingresar
      </Link>
    );
  }

  return (
    <>
      <Link href={base} className={linkClass}>
        Mis suscripciones
      </Link>
      <Link href={`${base}/pagos`} className={linkClass}>
        Pagos
      </Link>
      <Link href={`${base}/cuenta`} className={linkClass}>
        Mi cuenta
      </Link>
      <form action={logoutAction} className={mobile ? "px-3" : "inline"}>
        <input type="hidden" name="tenantSlug" value={tenantSlug} />
        <button type="submit" className={linkClass}>
          Salir
        </button>
      </form>
    </>
  );
}

function ManagerNav({
  tenantSlug,
  tenantName,
  base,
  isLoggedIn,
}: {
  tenantSlug: string;
  tenantName: string;
  base: string;
  isLoggedIn: boolean;
}) {
  return (
    <>
      <AnnounceBar />
      <header className="ori-header sticky top-8 z-40">
        <div className="ori-container flex h-[4.75rem] items-center justify-between gap-6 sm:h-[5.25rem]">
          <BrandLogo href={base} tenantName={tenantName} />

          <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 sm:gap-x-7">
            {isLoggedIn && (
              <>
                <Link href={base} className="ori-nav-link">
                  Panel
                </Link>
                <span
                  className="hidden h-4 w-px bg-gray-200 sm:block"
                  aria-hidden
                />
                <Link href={`${base}/dashboard`} className="ori-nav-link">
                  Dashboard
                </Link>
                <Link href={`${base}/suscripciones`} className="ori-nav-link">
                  Suscripciones
                </Link>
                <Link href={`${base}/suscriptores`} className="ori-nav-link">
                  Suscriptores
                </Link>
                <span
                  className="hidden h-4 w-px bg-gray-200 sm:block"
                  aria-hidden
                />
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

function SiteNavLink({
  item,
  active,
  mobile = false,
}: {
  item: NavItem;
  active: boolean;
  mobile?: boolean;
}) {
  const className = mobile
    ? `rounded-lg px-3 py-3 text-[0.7rem] font-medium uppercase tracking-[0.12em] transition ${
        active ? "bg-gray-900 text-white" : "text-gray-900 hover:bg-gray-50"
      }`
    : `text-[0.7rem] font-medium uppercase tracking-[0.12em] transition ${
        active ? "text-gray-900" : "text-gray-800 hover:text-gray-500"
      }`;

  if (item.external) {
    return (
      <a href={item.href} className={className}>
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
