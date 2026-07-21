-- One persistent row per 30-day billing period.
create table if not exists public.payment_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  subscription_id uuid not null references public.subscriptions (id),
  user_id uuid not null references public.users (id),
  cycle_number integer not null check (cycle_number > 0),
  period_start date not null,
  due_on date not null,
  amount_cents integer not null check (amount_cents >= 0),
  payment_method text not null
    check (payment_method in ('card_monthly', 'card_annual', 'transfer')),
  status text not null default 'upcoming'
    check (
      status in (
        'upcoming',
        'awaiting_payment',
        'submitted',
        'paid',
        'past_due',
        'failed',
        'cancelled'
      )
    ),
  payment_reference text,
  payment_receipt_path text,
  external_id text,
  submitted_at timestamptz,
  paid_at timestamptz,
  reminder_email_sent_at timestamptz,
  reminder_whatsapp_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, cycle_number),
  unique (subscription_id, due_on)
);

create unique index if not exists payment_cycles_external_id_unique
  on public.payment_cycles (external_id)
  where external_id is not null;

create index if not exists payment_cycles_tenant_status_due_idx
  on public.payment_cycles (tenant_id, status, due_on);

create index if not exists payment_cycles_user_due_idx
  on public.payment_cycles (user_id, due_on desc);

-- Backfill the next unpaid cycle for existing active subscriptions.
with last_paid as (
  select distinct on (pe.subscription_id)
    pe.subscription_id,
    coalesce(pe.due_on, pe.paid_at::date, pe.created_at::date) as paid_due_on
  from public.payment_events pe
  where pe.kind in ('confirmed', 'charged')
  order by pe.subscription_id, pe.paid_at desc nulls last, pe.created_at desc
)
insert into public.payment_cycles (
  tenant_id,
  subscription_id,
  user_id,
  cycle_number,
  period_start,
  due_on,
  amount_cents,
  payment_method,
  status
)
select
  s.tenant_id,
  s.id,
  s.user_id,
  2,
  coalesce(lp.paid_due_on, s.created_at::date),
  coalesce(lp.paid_due_on, s.created_at::date) + 30,
  coalesce(s.final_price_cents, 0),
  s.payment_method,
  case
    when coalesce(lp.paid_due_on, s.created_at::date) + 30 < current_date
      then 'past_due'
    when coalesce(lp.paid_due_on, s.created_at::date) + 30 <= current_date + 7
      then 'awaiting_payment'
    else 'upcoming'
  end
from public.subscriptions s
left join last_paid lp on lp.subscription_id = s.id
where s.deleted_at is null
  and s.status = 'active'
  and s.payment_method in ('transfer', 'card_monthly', 'card_annual')
on conflict (subscription_id, due_on) do nothing;

-- Keep initial pending transfers visible in the same cycle model.
insert into public.payment_cycles (
  tenant_id,
  subscription_id,
  user_id,
  cycle_number,
  period_start,
  due_on,
  amount_cents,
  payment_method,
  status,
  payment_reference,
  payment_receipt_path,
  submitted_at
)
select
  s.tenant_id,
  s.id,
  s.user_id,
  1,
  s.created_at::date,
  s.created_at::date,
  coalesce(s.final_price_cents, 0),
  s.payment_method,
  case
    when s.payment_reference is not null or s.payment_receipt_path is not null
      then 'submitted'
    else 'awaiting_payment'
  end,
  s.payment_reference,
  s.payment_receipt_path,
  case
    when s.payment_reference is not null or s.payment_receipt_path is not null
      then s.updated_at
    else null
  end
from public.subscriptions s
where s.deleted_at is null
  and s.status = 'pending_payment'
  and s.payment_method = 'transfer'
on conflict (subscription_id, due_on) do nothing;
