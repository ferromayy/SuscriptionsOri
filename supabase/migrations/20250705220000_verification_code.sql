-- Cambia verificación de link a código de 6 dígitos

alter table public.email_verification_tokens
  drop column if exists token_hash;

alter table public.email_verification_tokens
  add column if not exists code_hash text;

-- Si venís de la migración anterior con token_hash obligatorio:
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_verification_tokens'
      and column_name = 'token_hash'
  ) then
    alter table public.email_verification_tokens
      rename column token_hash to code_hash;
  end if;
end $$;

delete from public.email_verification_tokens;

create unique index if not exists email_verification_tokens_code_hash_idx
  on public.email_verification_tokens (code_hash);

drop index if exists public.email_verification_tokens_hash_idx;
