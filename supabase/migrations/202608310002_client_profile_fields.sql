-- Store the values collected by the Client signup form in the authenticated profile.
alter table public.profiles
  add column if not exists company_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  client_role_id uuid;
  requested_account_type text;
begin
  insert into public.profiles (id, email, display_name, phone, company_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'company_name',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    company_name = coalesce(excluded.company_name, public.profiles.company_name),
    updated_at = now();

  requested_account_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'client');
  if requested_account_type not in ('employee', 'super_admin') then
    select id into client_role_id from public.roles where role_code = 'client_user';
    if client_role_id is not null then
      insert into public.user_roles (user_id, role_id, is_active)
      values (new.id, client_role_id, true)
      on conflict (user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
