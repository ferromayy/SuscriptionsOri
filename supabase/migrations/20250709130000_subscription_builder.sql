-- Configurable subscription plans with dynamic fields and pricing

alter table public.plans
  add column if not exists internal_label text,
  add column if not exists field_count smallint not null default 0
    check (field_count >= 0 and field_count <= 5),
  add column if not exists sort_order integer not null default 0;

alter table public.subscriptions
  add column if not exists final_price_cents integer
    check (final_price_cents is null or final_price_cents >= 0);

create table if not exists public.plan_fields (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  sort_order smallint not null default 1 check (sort_order >= 1 and sort_order <= 5),
  label text not null,
  field_type text not null check (field_type in ('select', 'text')),
  affects_price boolean not null default false,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists plan_fields_plan_id_idx on public.plan_fields (plan_id);
create index if not exists plan_fields_deleted_at_idx on public.plan_fields (deleted_at);

create table if not exists public.plan_field_options (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.plan_fields (id) on delete cascade,
  label text not null,
  price_delta_cents integer not null default 0 check (price_delta_cents >= 0),
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists plan_field_options_field_id_idx on public.plan_field_options (field_id);
create index if not exists plan_field_options_deleted_at_idx on public.plan_field_options (deleted_at);

create table if not exists public.subscription_choices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  field_id uuid not null references public.plan_fields (id) on delete restrict,
  option_id uuid references public.plan_field_options (id) on delete restrict,
  text_value text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint subscription_choices_value_check check (
    (option_id is not null and text_value is null)
    or (option_id is null and text_value is not null and length(trim(text_value)) > 0)
  )
);

create unique index if not exists subscription_choices_active_unique_idx
  on public.subscription_choices (subscription_id, field_id)
  where deleted_at is null;

create index if not exists subscription_choices_subscription_id_idx
  on public.subscription_choices (subscription_id);

create index if not exists subscription_choices_deleted_at_idx
  on public.subscription_choices (deleted_at);

alter table public.plan_fields disable row level security;
alter table public.plan_field_options disable row level security;
alter table public.subscription_choices disable row level security;
