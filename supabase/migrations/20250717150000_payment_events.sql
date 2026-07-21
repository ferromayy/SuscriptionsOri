-- Append-only payment ledger (transfer confirms, card charges, manual activates)
create table if not exists public.payment_events (
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
  -- Día de cobro de este ciclo (fecha nominal del período)
  due_on date,
  -- Cuándo se registró / confirmó el pago
  paid_at timestamptz,
  payment_reference text,
  payment_receipt_path text,
  external_id text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payment_events_tenant_paid_idx
  on public.payment_events (tenant_id, paid_at desc nulls last, created_at desc);

create index if not exists payment_events_user_paid_idx
  on public.payment_events (user_id, paid_at desc nulls last, created_at desc);

create index if not exists payment_events_subscription_idx
  on public.payment_events (subscription_id, created_at desc);

-- Backfill: one confirmed payment per already-active subscription
insert into public.payment_events (
  tenant_id,
  subscription_id,
  user_id,
  source,
  kind,
  amount_cents,
  billing_cycle_days,
  due_on,
  paid_at,
  payment_reference,
  payment_receipt_path,
  notes
)
select
  s.tenant_id,
  s.id,
  s.user_id,
  case
    when s.payment_method = 'transfer' then 'transfer'
    when s.payment_method in ('card_monthly', 'card_annual') then 'card'
    else 'manual'
  end,
  'confirmed',
  coalesce(s.final_price_cents, 0),
  coalesce(s.billing_cycle_days, 30),
  (s.created_at at time zone 'UTC')::date,
  coalesce(s.updated_at, s.created_at),
  s.payment_reference,
  s.payment_receipt_path,
  'Registro inicial (suscripción ya activa)'
from public.subscriptions s
where s.deleted_at is null
  and s.status = 'active'
  and s.payment_status = 'authorized'
  and not exists (
    select 1
    from public.payment_events pe
    where pe.subscription_id = s.id
      and pe.kind in ('confirmed', 'charged')
  );
