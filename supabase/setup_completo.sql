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
drop table if exists public.subscription_choices cascade;
drop table if exists public.tenant_mp_connections cascade;
drop table if exists public.plan_field_options cascade;
drop table if exists public.plan_fields cascade;
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
  internal_label text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'ars',
  interval text not null default 'month' check (interval in ('month', 'year')),
  field_count smallint not null default 0 check (field_count >= 0 and field_count <= 5),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index plans_tenant_id_idx on public.plans (tenant_id);
create index plans_deleted_at_idx on public.plans (deleted_at);

create table public.plan_fields (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  sort_order smallint not null default 1 check (sort_order >= 1 and sort_order <= 5),
  label text not null,
  field_type text not null check (field_type in ('select', 'text')),
  affects_price boolean not null default false,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index plan_fields_plan_id_idx on public.plan_fields (plan_id);
create index plan_fields_deleted_at_idx on public.plan_fields (deleted_at);

create table public.plan_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.plan_fields (id) on delete cascade,
  label text not null,
  price_delta_cents integer not null default 0 check (price_delta_cents >= 0),
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index plan_field_options_field_id_idx on public.plan_field_options (field_id);
create index plan_field_options_deleted_at_idx on public.plan_field_options (deleted_at);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'pending_authorization', 'trialing', 'active', 'past_due', 'cancelled')),
  final_price_cents integer check (final_price_cents is null or final_price_cents >= 0),
  contact_email text,
  contact_phone text,
  contact_first_name text,
  contact_last_name text,
  delivery_method text
    check (
      delivery_method is null
      or delivery_method in ('shipping', 'andreani', 'store_pickup')
    ),
  delivery_details jsonb not null default '{}'::jsonb,
  payment_reference text,
  payment_receipt_path text,
  payment_method text
    check (
      payment_method is null
      or payment_method in ('card_monthly', 'card_annual', 'transfer')
    ),
  billing_interval text
    check (
      billing_interval is null
      or billing_interval in ('month', 'year')
    ),
  billing_cycle_days integer
    check (
      billing_cycle_days is null
      or billing_cycle_days in (15, 30, 45)
    ),
  mp_preapproval_id text,
  mp_init_point text,
  payment_status text
    check (
      payment_status is null
      or payment_status in ('pending', 'authorized', 'paused', 'cancelled')
    ),
  mp_last_rejection_detail text,
  mp_last_rejection_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.tenant_mp_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  mp_user_id text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  live_mode boolean not null default false,
  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  transfer_cbu text,
  transfer_alias text,
  transfer_holder_name text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id)
);

create index tenant_mp_connections_tenant_id_idx
  on public.tenant_mp_connections (tenant_id);
create index tenant_mp_connections_deleted_at_idx
  on public.tenant_mp_connections (deleted_at);
create index subscriptions_mp_preapproval_id_idx
  on public.subscriptions (mp_preapproval_id);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  subscription_id uuid not null references public.subscriptions (id),
  user_id uuid not null references public.users (id),
  source text not null
    check (source in ('transfer', 'card', 'manual')),
  kind text not null
    check (kind in ('submitted', 'confirmed', 'charged', 'rejected', 'cancelled')),
  amount_cents integer not null check (amount_cents >= 0),
  billing_cycle_days integer
    check (
      billing_cycle_days is null
      or billing_cycle_days in (15, 30, 45)
    ),
  due_on date,
  paid_at timestamptz,
  payment_reference text,
  payment_receipt_path text,
  external_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index payment_events_tenant_paid_idx
  on public.payment_events (tenant_id, paid_at desc nulls last, created_at desc);
create index payment_events_user_paid_idx
  on public.payment_events (user_id, paid_at desc nulls last, created_at desc);
create index payment_events_subscription_idx
  on public.payment_events (subscription_id, created_at desc);

create table public.delivery_fulfillments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  subscription_id uuid not null references public.subscriptions (id),
  user_id uuid not null references public.users (id),
  due_on date not null,
  status text not null
    check (status in ('ready', 'shipped')),
  ready_at timestamptz,
  shipped_at timestamptz,
  shipped_email_sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, due_on)
);

create index delivery_fulfillments_tenant_due_idx
  on public.delivery_fulfillments (tenant_id, due_on);
create index delivery_fulfillments_subscription_idx
  on public.delivery_fulfillments (subscription_id);

create table public.subscription_choices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  field_id uuid not null references public.plan_fields (id) on delete restrict,
  option_id uuid references public.plan_field_options (id) on delete restrict,
  text_value text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint subscription_choices_value_check check (
    (option_id is not null and text_value is null)
    or (option_id is null and text_value is not null and length(trim(text_value)) > 0)
  )
);

create unique index subscription_choices_active_unique_idx
  on public.subscription_choices (subscription_id, field_id)
  where deleted_at is null;

create index subscription_choices_subscription_id_idx
  on public.subscription_choices (subscription_id);

create index subscription_choices_deleted_at_idx
  on public.subscription_choices (deleted_at);

create unique index subscriptions_active_unique_idx
  on public.subscriptions (tenant_id, user_id, plan_id)
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
alter table public.plan_fields disable row level security;
alter table public.plan_field_options disable row level security;
alter table public.subscriptions disable row level security;
alter table public.subscription_choices disable row level security;
alter table public.tenant_mp_connections disable row level security;
alter table public.payment_events disable row level security;
alter table public.delivery_fulfillments disable row level security;
