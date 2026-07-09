-- Borrado lógico en entidades principales

alter table public.users
  add column if not exists deleted_at timestamptz;

alter table public.tenants
  add column if not exists deleted_at timestamptz;

alter table public.tenant_members
  add column if not exists deleted_at timestamptz;

alter table public.plans
  add column if not exists deleted_at timestamptz;

alter table public.subscriptions
  add column if not exists deleted_at timestamptz;

alter table public.platform_invitations
  add column if not exists deleted_at timestamptz;

-- Índices únicos solo entre registros activos
drop index if exists public.users_email_idx;
create unique index if not exists users_email_active_idx
  on public.users (email)
  where deleted_at is null;

alter table public.tenants drop constraint if exists tenants_slug_key;
drop index if exists public.tenants_slug_idx;
create unique index if not exists tenants_slug_active_idx
  on public.tenants (slug)
  where deleted_at is null;

alter table public.tenant_members
  drop constraint if exists tenant_members_tenant_id_user_id_key;
create unique index if not exists tenant_members_active_unique_idx
  on public.tenant_members (tenant_id, user_id)
  where deleted_at is null;

alter table public.subscriptions
  drop constraint if exists subscriptions_tenant_id_user_id_key;
create unique index if not exists subscriptions_active_unique_idx
  on public.subscriptions (tenant_id, user_id)
  where deleted_at is null;

create index if not exists users_deleted_at_idx on public.users (deleted_at);
create index if not exists tenants_deleted_at_idx on public.tenants (deleted_at);
create index if not exists tenant_members_deleted_at_idx
  on public.tenant_members (deleted_at);
create index if not exists plans_deleted_at_idx on public.plans (deleted_at);
create index if not exists subscriptions_deleted_at_idx
  on public.subscriptions (deleted_at);
create index if not exists platform_invitations_deleted_at_idx
  on public.platform_invitations (deleted_at);
