-- Checkout details for subscriber signup (contact, delivery, payment stub)

alter table public.subscriptions
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_first_name text,
  add column if not exists contact_last_name text,
  add column if not exists delivery_method text
    check (
      delivery_method is null
      or delivery_method in ('shipping', 'andreani', 'store_pickup')
    ),
  add column if not exists delivery_details jsonb not null default '{}'::jsonb,
  add column if not exists payment_reference text;
