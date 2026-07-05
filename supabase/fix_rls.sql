-- Corré esto en Supabase SQL Editor si ves error de "row-level security policy"
-- El servidor usa service role y no debería pasar, pero por si RLS quedó activo:

alter table if exists public.users disable row level security;
alter table if exists public.sessions disable row level security;
alter table if exists public.platform_admins disable row level security;
alter table if exists public.tenants disable row level security;
alter table if exists public.platform_invitations disable row level security;
alter table if exists public.tenant_members disable row level security;
alter table if exists public.plans disable row level security;
alter table if exists public.subscriptions disable row level security;
alter table if exists public.profiles disable row level security;
