-- Verificación de email (corré si ya tenés la base creada sin estos campos)

alter table public.users
  add column if not exists email_verified_at timestamptz;

drop table if exists public.email_verification_tokens cascade;

create table public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index email_verification_tokens_code_hash_idx
  on public.email_verification_tokens (code_hash);
create index email_verification_tokens_user_id_idx
  on public.email_verification_tokens (user_id);

-- Super admin y usuarios existentes: marcar como verificados
update public.users
set email_verified_at = coalesce(email_verified_at, now())
where email_verified_at is null;
