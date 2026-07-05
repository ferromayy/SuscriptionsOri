-- ============================================================
-- RESET: borra el esquema viejo (si existía con Supabase Auth)
-- Corré esto PRIMERO, luego el initial_schema.sql
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.register_public_subscriber(text, uuid) cascade;
drop function if exists public.is_platform_admin() cascade;
drop function if exists public.is_tenant_member(uuid) cascade;
drop function if exists public.set_updated_at() cascade;

drop table if exists public.subscriptions cascade;
drop table if exists public.plans cascade;
drop table if exists public.tenant_members cascade;
drop table if exists public.platform_invitations cascade;
drop table if exists public.platform_admins cascade;
drop table if exists public.tenants cascade;
drop table if exists public.sessions cascade;
drop table if exists public.users cascade;
drop table if exists public.profiles cascade;
