import Link from "next/link";

export default async function ForgotPasswordSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : undefined;
  const loginHref = safeNext
    ? `/auth/login?next=${encodeURIComponent(safeNext)}`
    : "/auth/login";

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        <h1 className="ori-title text-2xl">Revisá tu correo</h1>
        <p className="ori-subtitle mt-4">
          Si existe una cuenta verificada con{" "}
          {email ? (
            <strong className="text-gray-800">{email}</strong>
          ) : (
            "ese email"
          )}
          , te enviamos un link para restablecer tu contraseña. El link expira
          en 30 minutos.
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Si no lo ves, revisá la carpeta de spam o volvé a intentar en unos
          minutos.
        </p>
        <Link
          href={loginHref}
          className="mt-8 inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
