drop policy if exists client_kyc_profiles_admin_insert on public.client_kyc_profiles;
create policy client_kyc_profiles_admin_insert on public.client_kyc_profiles
  for insert to authenticated
  with check (public.is_super_admin() and status = 'draft');

create or replace function public.create_client_kyc_draft(
  p_legal_name text,
  p_client_code text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_client_id uuid;
  normalized_name text := nullif(btrim(coalesce(p_legal_name, '')), '');
  normalized_code text := nullif(upper(btrim(coalesce(p_client_code, ''))), '');
begin
  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'Only Super Admin can start client onboarding';
  end if;
  if normalized_name is null or length(normalized_name) > 180 then
    raise exception using errcode = '22023', message = 'Enter a client legal name (maximum 180 characters)';
  end if;
  if normalized_code is not null and normalized_code !~ '^[A-Z0-9][A-Z0-9-]{2,31}$' then
    raise exception using errcode = '22023', message = 'Client code may contain uppercase letters, numbers, and hyphens';
  end if;
  if normalized_code is not null and exists (select 1 from public.client_accounts where client_code = normalized_code) then
    raise exception using errcode = '23505', message = 'This client code is already in use';
  end if;

  insert into public.client_accounts (client_code, legal_name, status)
  values (normalized_code, normalized_name, 'on_hold')
  returning id into created_client_id;

  insert into public.client_kyc_profiles (client_id, status)
  values (created_client_id, 'draft');

  return created_client_id;
end;
$$;

revoke all on function public.create_client_kyc_draft(text, text) from public;
revoke execute on function public.create_client_kyc_draft(text, text) from anon;
grant execute on function public.create_client_kyc_draft(text, text) to authenticated;
