# Subscriptions Ori

Plataforma de suscripciones multi-tenant con Next.js, Supabase y PostgreSQL.

## Stack

- **Frontend / Backend:** Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- **Base de datos:** Supabase (PostgreSQL + Auth + RLS)
- **Deploy:** Vercel
- **Repo:** GitHub

## Requisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com)

## 1. Variables de entorno

Copia el ejemplo y completa con tus credenciales de Supabase:

```bash
cp .env.example .env.local
```

| Variable | Dónde obtenerla |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (solo server) |
| `SUPER_ADMIN_EMAILS` | Email del Super Admin hardcodeado |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` en local |

## 2. Base de datos

En el [SQL Editor](https://supabase.com/dashboard) de tu proyecto, ejecuta el contenido de:

```
supabase/migrations/20250705180000_initial_schema.sql
```

Luego crea el Super Admin:

1. Supabase → **Authentication → Users → Add user** (email + password).
2. Copia el `user_id` (UUID).
3. Ejecuta en SQL Editor:

```sql
insert into public.platform_admins (user_id)
values ('TU-USER-UUID-AQUI')
on conflict (user_id) do nothing;
```

4. Asegúrate de que ese email esté en `SUPER_ADMIN_EMAILS`.

## 3. Desarrollo local

```bash
npm install
npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Health API: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- Super Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## 4. Deploy en Vercel

1. Importa el repo `ferromayy/SuscriptionsOri` en Vercel.
2. Agrega las mismas variables de entorno que en `.env.local`.
3. En Supabase → Authentication → URL Configuration, agrega:
   - Site URL: `https://tu-dominio.vercel.app`
   - Redirect URLs: `https://tu-dominio.vercel.app/**`

## Estructura

```
src/
  app/              # Rutas App Router
  components/       # UI
  lib/supabase/     # Clientes browser, server y admin
  lib/auth/         # Roles y permisos
  types/            # Tipos de la base de datos
supabase/
  migrations/       # Esquema SQL + RLS
```

## Roles

| Rol | Registro | Acceso |
|-----|----------|--------|
| Super Admin | Hardcodeado (seed) | `/admin` |
| Cliente | Propio + invitación (próximo paso) | `/app/[tenant]` |
| Suscripto | Propio en portal del cliente | `/[slug]/join` |
