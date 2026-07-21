-- Track per-cycle delivery progress for weekly operations sheet
create table if not exists public.delivery_fulfillments (
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

create index if not exists delivery_fulfillments_tenant_due_idx
  on public.delivery_fulfillments (tenant_id, due_on);

create index if not exists delivery_fulfillments_subscription_idx
  on public.delivery_fulfillments (subscription_id);

alter table public.delivery_fulfillments disable row level security;
