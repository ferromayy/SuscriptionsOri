-- pending_payment = transfer awaiting tenant confirmation
-- pending_authorization = card awaiting Mercado Pago authorization

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (
    status in (
      'pending_payment',
      'pending_authorization',
      'trialing',
      'active',
      'past_due',
      'cancelled'
    )
  );

-- Existing card subscriptions waiting on MP should use the new status
update public.subscriptions
set status = 'pending_authorization'
where status = 'pending_payment'
  and payment_method in ('card_monthly', 'card_annual')
  and deleted_at is null;
