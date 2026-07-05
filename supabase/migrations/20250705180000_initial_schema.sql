-- Extensions
create extension if not exists "pgcrypto";

-- Profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Platform super admins (hardcoded users)
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Tenants (client organizations)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'pending_owner'
    check (status in ('pending_owner', 'active', 'suspended', 'cancelled')),
  settings jsonb not null default '{"allow_public_signup": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tenants_status_idx on public.tenants (status);
create index tenants_slug_idx on public.tenants (slug);

-- Super Admin invitations for future clients
create table public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  token_hash text not null,
  invited_by uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index platform_invitations_tenant_id_idx on public.platform_invitations (tenant_id);
create index platform_invitations_email_idx on public.platform_invitations (lower(email));
create unique index platform_invitations_pending_email_idx
  on public.platform_invitations (tenant_id, lower(email))
  where status = 'pending';

-- Tenant membership
create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'subscriber')),
  joined_via text not null check (joined_via in ('client_invite', 'public_signup')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index tenant_members_user_id_idx on public.tenant_members (user_id);
create index tenant_members_tenant_id_idx on public.tenant_members (tenant_id);

-- Plans per tenant
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  interval text not null default 'month' check (interval in ('month', 'year')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index plans_tenant_id_idx on public.plans (tenant_id);

-- Subscriber subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index subscriptions_tenant_id_idx on public.subscriptions (tenant_id);
create index subscriptions_user_id_idx on public.subscriptions (user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: platform admin check
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

-- Helper: tenant membership check
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Public subscriber registration (post-signup, server-side RPC)
create or replace function public.register_public_subscriber(
  p_tenant_slug text,
  p_plan_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_subscription_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_tenant_id
  from public.tenants
  where slug = p_tenant_slug
    and status = 'active'
    and coalesce((settings ->> 'allow_public_signup')::boolean, true) = true;

  if v_tenant_id is null then
    raise exception 'Tenant not available for public signup';
  end if;

  if not exists (
    select 1 from public.plans
    where id = p_plan_id
      and tenant_id = v_tenant_id
      and is_active = true
  ) then
    raise exception 'Invalid plan for tenant';
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, joined_via)
  values (v_tenant_id, auth.uid(), 'subscriber', 'public_signup')
  on conflict (tenant_id, user_id) do update
    set status = 'active'
  where public.tenant_members.status = 'inactive';

  insert into public.subscriptions (tenant_id, user_id, plan_id, status)
  values (v_tenant_id, auth.uid(), p_plan_id, 'trialing')
  on conflict (tenant_id, user_id) do update
    set plan_id = excluded.plan_id,
        updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.platform_invitations enable row level security;
alter table public.tenant_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Platform admins table: only readable by platform admins
create policy "Platform admins can view platform admins"
  on public.platform_admins for select
  using (public.is_platform_admin());

-- Tenants
create policy "Platform admins manage all tenants"
  on public.tenants for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Members can view their tenants"
  on public.tenants for select
  using (public.is_tenant_member(id));

create policy "Public can view active tenant by slug"
  on public.tenants for select
  using (status = 'active');

-- Platform invitations
create policy "Platform admins manage invitations"
  on public.platform_invitations for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Tenant members
create policy "Platform admins manage all members"
  on public.tenant_members for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Members can view members in their tenant"
  on public.tenant_members for select
  using (public.is_tenant_member(tenant_id));

create policy "Users can view own membership"
  on public.tenant_members for select
  using (auth.uid() = user_id);

-- Plans
create policy "Platform admins manage all plans"
  on public.plans for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Tenant owners and admins manage plans"
  on public.plans for all
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = plans.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
        and tm.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = plans.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
        and tm.status = 'active'
    )
  );

create policy "Anyone can view active plans for active tenants"
  on public.plans for select
  using (
    is_active = true
    and exists (
      select 1 from public.tenants t
      where t.id = plans.tenant_id and t.status = 'active'
    )
  );

-- Subscriptions
create policy "Platform admins manage all subscriptions"
  on public.subscriptions for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "Users can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Tenant owners can view tenant subscriptions"
  on public.subscriptions for select
  using (
    exists (
      select 1 from public.tenant_members tm
      where tm.tenant_id = subscriptions.tenant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
        and tm.status = 'active'
    )
  );

-- RPC grants
grant execute on function public.register_public_subscriber(text, uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
