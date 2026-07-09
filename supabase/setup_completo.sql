-- ============================================================
-- SETUP COMPLETO — corré SOLO este archivo en Supabase SQL Editor
-- (reset + esquema nuevo con auth propio)
-- ============================================================

-- RESET
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
drop table if exists public.email_verification_tokens cascade;
drop table if exists public.password_reset_tokens cascade;
drop table if exists public.users cascade;
drop table if exists public.profiles cascade;

-- SCHEMA NUEVO
create extension if not exists "pgcrypto";

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_email_lowercase check (email = lower(email))
);

create unique index users_email_active_idx on public.users (email)
  where deleted_at is null;
create index users_deleted_at_idx on public.users (deleted_at);

create table public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index email_verification_tokens_code_hash_idx
  on public.email_verification_tokens (code_hash);
create index email_verification_tokens_user_id_idx
  on public.email_verification_tokens (user_id);

create table public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index password_reset_tokens_token_hash_idx
  on public.password_reset_tokens (token_hash);
create index password_reset_tokens_user_id_idx
  on public.password_reset_tokens (user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index sessions_token_hash_idx on public.sessions (token_hash);
create index sessions_user_id_idx on public.sessions (user_id);
create index sessions_expires_at_idx on public.sessions (expires_at);

create table public.platform_admins (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'pending_owner'
    check (status in ('pending_owner', 'active', 'suspended', 'cancelled')),
  settings jsonb not null default '{"allow_public_signup": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index tenants_slug_active_idx on public.tenants (slug)
  where deleted_at is null;
create index tenants_status_idx on public.tenants (status);
create index tenants_deleted_at_idx on public.tenants (deleted_at);

create table public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  token_hash text not null,
  verification_code_hash text,
  invited_by uuid not null references public.users (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index platform_invitations_tenant_id_idx on public.platform_invitations (tenant_id);
create index platform_invitations_email_idx on public.platform_invitations (lower(email));
create index platform_invitations_deleted_at_idx on public.platform_invitations (deleted_at);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'subscriber')),
  joined_via text not null check (joined_via in ('client_invite', 'public_signup')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index tenant_members_active_unique_idx
  on public.tenant_members (tenant_id, user_id)
  where deleted_at is null;
create index tenant_members_user_id_idx on public.tenant_members (user_id);
create index tenant_members_tenant_id_idx on public.tenant_members (tenant_id);
create index tenant_members_deleted_at_idx on public.tenant_members (deleted_at);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  interval text not null default 'month' check (interval in ('month', 'year')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index plans_tenant_id_idx on public.plans (tenant_id);
create index plans_deleted_at_idx on public.plans (deleted_at);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index subscriptions_active_unique_idx
  on public.subscriptions (tenant_id, user_id)
  where deleted_at is null;
create index subscriptions_tenant_id_idx on public.subscriptions (tenant_id);
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_deleted_at_idx on public.subscriptions (deleted_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Sin RLS: la app valida permisos en Next.js (auth propio + service role)
alter table public.users disable row level security;
alter table public.email_verification_tokens disable row level security;
alter table public.password_reset_tokens disable row level security;
alter table public.sessions disable row level security;
alter table public.platform_admins disable row level security;
alter table public.tenants disable row level security;
alter table public.platform_invitations disable row level security;
alter table public.tenant_members disable row level security;
alter table public.plans disable row level security;
alter table public.subscriptions disable row level security;
