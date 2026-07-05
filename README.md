# Subscriptions Ori

Plataforma de suscripciones multi-tenant.

## Stack

- **App:** Next.js 16, TypeScript, Tailwind CSS
- **DB:** Supabase PostgreSQL (solo base de datos — **sin Supabase Auth**)
- **Auth:** Propio (users + sessions + bcrypt) — **$0 en MAU**
- **Roles:** Tablas `platform_admins` y `tenant_members` — validados en Next.js
- **Deploy:** Vercel

## Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SECRET_KEY` | Secret key (solo server, acceso a Postgres) |
| `SUPER_ADMIN_EMAIL` | Email del super admin (se crea solo) |
| `SUPER_ADMIN_PASSWORD` | Contraseña del super admin |
| `NEXT_PUBLIC_APP_URL` | URL de la app |

> Ya **no** necesitás `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — no usamos Supabase Auth.

## Base de datos

### Si es instalación nueva

Ejecutá en el SQL Editor de Supabase:

```
supabase/migrations/20250705180000_initial_schema.sql
```

### Si ya corriste la migración vieja (con auth.users)

1. `supabase/migrations/20250705200000_reset_old_auth_schema.sql`
2. `supabase/migrations/20250705180000_initial_schema.sql`

## Desarrollo

```bash
npm install
npm run dev
```

El super admin se crea automáticamente al primer request si configuraste `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD`.

- Home: http://localhost:3000
- Admin: http://localhost:3000/admin/login
- Health: http://localhost:3000/api/health

## Arquitectura de auth (Opción C)

```
Usuario → login (Server Action)
       → verifica password (bcrypt)
       → crea session en tabla sessions
       → cookie httpOnly session_token
       → middleware valida sesión
       → permisos en lib/auth/permissions.ts
       → DB vía SUPABASE_SECRET_KEY (service role)
```

Supabase cobra solo por el plan de **base de datos**, no por autenticación de usuarios.

## Estructura

```
src/lib/auth/     → session, password, permissions, bootstrap
src/lib/db/       → cliente PostgreSQL (service role)
supabase/migrations/
```
