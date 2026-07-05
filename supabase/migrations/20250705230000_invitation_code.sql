-- Código de verificación en la invitación al cliente (enviado por email al crear el tenant)

alter table public.platform_invitations
  add column if not exists verification_code_hash text;
