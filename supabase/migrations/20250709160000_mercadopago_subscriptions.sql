-- Mercado Pago connections per tenant + billing fields on subscriptions

create table if not exists public.tenant_mp_connections (
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

create index if not exists tenant_mp_connections_tenant_id_idx
  on public.tenant_mp_connections (tenant_id);
create index if not exists tenant_mp_connections_deleted_at_idx
  on public.tenant_mp_connections (deleted_at);

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('pending_payment', 'trialing', 'active', 'past_due', 'cancelled'));

alter table public.subscriptions
  add column if not exists payment_method text
    check (
      payment_method is null
      or payment_method in ('card_monthly', 'card_annual', 'transfer')
    ),
  add column if not exists billing_interval text
    check (
      billing_interval is null
      or billing_interval in ('month', 'year')
    ),
  add column if not exists mp_preapproval_id text,
  add column if not exists mp_init_point text,
  add column if not exists payment_status text
    check (
      payment_status is null
      or payment_status in ('pending', 'authorized', 'paused', 'cancelled')
    );

create index if not exists subscriptions_mp_preapproval_id_idx
  on public.subscriptions (mp_preapproval_id);

alter table public.tenant_mp_connections disable row level security;
