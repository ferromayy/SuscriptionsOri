-- How often the subscription is billed / delivered (chosen at checkout)
alter table public.subscriptions
  add column if not exists billing_cycle_days integer;

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_cycle_days_check;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_days_check
  check (
    billing_cycle_days is null
    or billing_cycle_days in (15, 30, 45)
  );

-- Existing subscriptions without a cycle default to 30 days
update public.subscriptions
set billing_cycle_days = 30
where billing_cycle_days is null
  and deleted_at is null;

comment on column public.subscriptions.billing_cycle_days is
  'Cadence in days for delivery/billing: 15, 30, or 45. Charged per cycle from subscription start.';
