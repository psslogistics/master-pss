-- Keep active system Super Admins in the employee audience even when they do
-- not have an employee_profiles row. The server-side Super Admin guard still
-- requires an active profile and the super_admin role.
create or replace function private.get_auth_context()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'private'
as $function$
  with current_identity as (
    select auth.uid() as user_id
  ),
  identity_state as (
    select
      ci.user_id,
      exists (
        select 1 from public.employee_profiles ep
        join public.profiles p on p.id = ep.user_id
        where ep.user_id = ci.user_id
          and ep.employment_status = 'active'
          and p.status = 'active'
      ) as active_employee
    from current_identity ci
  ),
  role_links as (
    select ur.role_id, r.role_code, r.scope
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select user_id from current_identity)
      and ur.is_active = true
  ),
  audience as (
    select case
      when (
        (select active_employee from identity_state)
        or exists (select 1 from role_links where role_code = 'super_admin')
      )
        and exists (select 1 from role_links where scope in ('employee', 'system') or role_code = 'super_admin')
        then 'employee'
      when exists (select 1 from role_links where scope = 'client' or role_code = 'client_user')
        then 'client'
      else 'unknown'
    end as value
  ),
  scoped_roles as (
    select * from role_links
    where (select value from audience) = 'employee' and scope in ('employee', 'system')
       or (select value from audience) = 'client' and (scope = 'client' or role_code = 'client_user')
  ),
  scoped_assignments as (
    select eca.client_id
    from public.employee_client_assignments eca
    where eca.employee_user_id = (select user_id from current_identity)
      and eca.is_active = true
      and (select value from audience) = 'employee'
  ),
  scoped_memberships as (
    select cm.client_id
    from public.client_memberships cm
    where cm.user_id = (select user_id from current_identity)
      and cm.membership_status = 'active'
      and (select value from audience) = 'client'
  ),
  active_clients as (
    select ca.id
    from public.client_accounts ca
    where ca.status = 'active'
      and ca.id in (select client_id from scoped_assignments union select client_id from scoped_memberships)
  )
  select case
    when (select user_id from current_identity) is null then null::jsonb
    else jsonb_build_object(
      'user_id', (select user_id from current_identity),
      'audience', (select value from audience),
      'profile_status', (select p.status from public.profiles p where p.id = (select user_id from current_identity) limit 1),
      'employment_status', (select ep.employment_status from public.employee_profiles ep where ep.user_id = (select user_id from current_identity) limit 1),
      'roles', coalesce((select jsonb_agg(jsonb_build_object('role_code', role_code, 'scope', scope)) from scoped_roles), '[]'::jsonb),
      'role_ids', coalesce((select jsonb_agg(jsonb_build_object('role_id', role_id)) from scoped_roles), '[]'::jsonb),
      'permissions', coalesce((select jsonb_agg(jsonb_build_object('permission_key', rp.permission_key)) from public.role_permissions rp join scoped_roles sr on sr.role_id = rp.role_id), '[]'::jsonb),
      'permission_overrides', coalesce((select jsonb_agg(jsonb_build_object('permission_key', epo.permission_key, 'mode', epo.mode)) from public.employee_permission_overrides epo where epo.employee_user_id = (select user_id from current_identity)), '[]'::jsonb),
      'assignments', coalesce((select jsonb_agg(jsonb_build_object('client_id', client_id)) from scoped_assignments), '[]'::jsonb),
      'memberships', coalesce((select jsonb_agg(jsonb_build_object('client_id', client_id, 'membership_status', 'active')) from scoped_memberships), '[]'::jsonb),
      'active_client_ids', coalesce((select jsonb_agg(id) from active_clients), '[]'::jsonb)
    )
  end;
$function$;
