-- Allow multiple subscriptions per user per tenant (one active row per plan)

drop index if exists public.subscriptions_active_unique_idx;

create unique index subscriptions_active_unique_idx
  on public.subscriptions (tenant_id, user_id, plan_id)
  where deleted_at is null;
