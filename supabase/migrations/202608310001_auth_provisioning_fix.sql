-- Keep self-service signup safe by defaulting to the least-privileged client role.
-- Privileged roles are assigned only by trusted server-side provisioning flows.
alter table public.client_memberships
  add column if not exists assigned_by uuid references auth.users(id),
  add column if not exists assigned_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  client_role_id uuid;
  requested_account_type text;
begin
  insert into public.profiles (id, email, display_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    'active'
  )
  on conflict (id) do update set email = excluded.email, updated_at = now();

  requested_account_type := coalesce(new.raw_user_meta_data ->> 'account_type', 'client');

  -- Employee and Super Admin provisioning is completed by trusted Master APIs.
  -- User-editable metadata can suppress the default, but can never grant privilege.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Repair active users created before this migration when no role exists.
insert into public.user_roles (user_id, role_id, is_active)
select p.id, r.id, true
from public.profiles p
join public.roles r on r.role_code = 'client_user'
join auth.users u on u.id = p.id
where p.status = 'active'
  and not exists (select 1 from public.user_roles ur where ur.user_id = p.id)
  and coalesce(u.raw_user_meta_data ->> 'account_type', 'client') not in ('employee', 'super_admin')
on conflict (user_id) do nothing;

drop policy if exists client_memberships_admin_write on public.client_memberships;
create policy client_memberships_admin_write on public.client_memberships
  for all using (public.is_super_admin()) with check (public.is_super_admin());
