-- Optional receipt file path for transfer payments (Supabase Storage)
alter table public.subscriptions
  add column if not exists payment_receipt_path text;
