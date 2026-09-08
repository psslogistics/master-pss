-- Identity/profile additions only. Operational data remains outside Supabase.

-- Client codes are assigned by Super Admin. New client accounts may remain unassigned.
alter table public.client_accounts
  alter column client_code drop not null;

alter table public.client_memberships
  add column if not exists assigned_by uuid references auth.users(id),
  add column if not exists assigned_at timestamptz not null default now();

-- Allow authenticated users to edit the company field exposed by the Client profile.
grant update (display_name, phone, company_name, avatar_url) on public.profiles to authenticated;

-- Generate a human-readable employee ID only when Super Admin leaves it blank.
-- The transaction lock makes the sequence safe across concurrent provisioning requests;
-- the unique constraint on employee_profiles.employee_code remains the final guard.
create or replace function public.generate_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  candidate text;
begin
  perform pg_advisory_xact_lock(hashtext('pss.employee_code'));
  select coalesce(max((substring(employee_code from 5))::integer), 0) + 1
    into next_number
    from public.employee_profiles
   where employee_code ~ '^EMP-[0-9]+$';
  candidate := 'EMP-' || lpad(next_number::text, 4, '0');
  return candidate;
end;
$$;

revoke all on function public.generate_employee_code() from public;
grant execute on function public.generate_employee_code() to service_role;

-- Keep signup identity/profile provisioning, but leave client-code assignment to
-- Super Admin instead of deriving a code from the Auth UUID.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_client_id uuid;
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
    insert into public.client_accounts (client_code, legal_name)
    values (null, coalesce(new.raw_user_meta_data ->> 'company_name', 'New client'))
    returning id into new_client_id;
    insert into public.client_memberships (user_id, client_id, is_primary)
    values (new.id, new_client_id, true);
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

-- Do not expose the generator to ordinary authenticated users.
