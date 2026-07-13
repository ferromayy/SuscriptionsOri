-- Persist last Mercado Pago rejection reason for cancelled card subscriptions
alter table public.subscriptions
  add column if not exists mp_last_rejection_detail text,
  add column if not exists mp_last_rejection_at timestamptz;
