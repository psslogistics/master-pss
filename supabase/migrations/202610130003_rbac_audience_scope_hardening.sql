-- RBAC hardening: keep employee assignment scope separate from client membership scope.
-- This migration is intentionally additive and preserves existing permission keys.

alter table public.permissions
  add column if not exists audience text not null default 'employee',
  add column if not exists sensitivity text not null default 'normal',
  add column if not exists scope_kind text not null default 'assigned_clients';

update public.permissions
set audience = case when panel = 'client' then 'client' else 'employee' end
where audience is null or audience = 'employee';

insert into public.permissions (permission_key, label, description, permission_group, panel, resource, action, route, assignable_to_employee, audience, sensitivity, scope_kind)
values
  ('admin.shipments.assigned.view', 'View assigned shipment summaries', 'View non-sensitive shipment information for assigned clients.', 'Operations', 'admin', 'shipments', 'view_assigned', '/dashboard/shipments', true, 'employee', 'normal', 'assigned_clients'),
  ('admin.shipments.sensitive.view', 'View sensitive shipment fields', 'View addresses, consignee, declared value, provider and internal shipment fields.', 'Operations', 'admin', 'shipments', 'view_sensitive', '/dashboard/shipments', true, 'employee', 'restricted', 'assigned_clients'),
  ('admin.shipments.export', 'Export assigned shipments', 'Export shipment data for assigned clients.', 'Reports & Insights', 'admin', 'shipments', 'export', '/dashboard/shipments', true, 'employee', 'confidential', 'assigned_clients'),
  ('admin.documents.pod.view', 'View proof of delivery', 'View proof-of-delivery metadata for assigned clients.', 'Operations', 'admin', 'documents', 'view_pod', '/dashboard/tracking', true, 'employee', 'confidential', 'assigned_clients'),
  ('admin.documents.pod.download', 'Download proof of delivery', 'Download proof-of-delivery files for assigned clients.', 'Operations', 'admin', 'documents', 'download_pod', '/dashboard/tracking', true, 'employee', 'restricted', 'assigned_clients'),
  ('admin.exceptions.view', 'View exceptions', 'View shipment exceptions and NDR/return records.', 'Operations', 'admin', 'exceptions', 'view', '/dashboard/tracking', true, 'employee', 'normal', 'assigned_clients'),
  ('admin.exceptions.manage', 'Manage exceptions', 'Update exception, NDR and return records.', 'Operations', 'admin', 'exceptions', 'manage', '/dashboard/tracking', true, 'employee', 'normal', 'assigned_clients'),
  ('admin.weight.view', 'View weight reconciliation', 'View weight reconciliation records for assigned clients.', 'Finance', 'admin', 'weight', 'view', '/dashboard/weight-reconciliation', true, 'employee', 'confidential', 'assigned_clients'),
  ('admin.weight.manage', 'Update weight reconciliation', 'Record provider weight and reconciliation changes.', 'Finance', 'admin', 'weight', 'manage', '/dashboard/weight-reconciliation', true, 'employee', 'confidential', 'assigned_clients'),
  ('admin.weight.resolve', 'Resolve weight disputes', 'Resolve weight disputes and financial adjustments.', 'Finance', 'admin', 'weight', 'resolve', '/dashboard/weight-reconciliation', true, 'employee', 'restricted', 'assigned_clients'),
  ('admin.tickets.close', 'Close tickets', 'Close support tickets for assigned clients.', 'Support', 'admin', 'tickets', 'close', '/dashboard/support', true, 'employee', 'normal', 'assigned_clients'),
  ('admin.tickets.reassign', 'Reassign tickets', 'Reassign support tickets within the employee scope.', 'Support', 'admin', 'tickets', 'reassign', '/dashboard/support', true, 'employee', 'normal', 'assigned_clients')
on conflict (permission_key) do update set
  audience = excluded.audience,
  sensitivity = excluded.sensitivity,
  scope_kind = excluded.scope_kind,
  assignable_to_employee = excluded.assignable_to_employee;

create or replace function private.get_auth_context()
returns jsonb
language sql
stable
security definer
set search_path = public, private
as $$
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
      when (select active_employee from identity_state)
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
$$;

revoke all on function private.get_auth_context() from public, anon;
grant execute on function private.get_auth_context() to authenticated, service_role;

create or replace function public.get_auth_context()
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$ select private.get_auth_context(); $$;

revoke all on function public.get_auth_context() from public, anon;
grant execute on function public.get_auth_context() to authenticated, service_role;

create or replace function private.transfer_employee_client_assignment(
  target_client_id uuid,
  target_employee_user_id uuid,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  previous_employee_ids uuid[];
begin
  if not private.is_super_admin() then
    raise exception 'super_admin_required';
  end if;
  if not exists (select 1 from public.client_accounts where id = target_client_id and status = 'active') then
    raise exception 'client_not_found';
  end if;
  if not exists (select 1 from public.employee_profiles ep join public.profiles p on p.id = ep.user_id where ep.user_id = target_employee_user_id and ep.employment_status = 'active' and p.status = 'active') then
    raise exception 'employee_not_active';
  end if;
  select coalesce(array_agg(employee_user_id), '{}'::uuid[]) into previous_employee_ids
  from public.employee_client_assignments
  where client_id = target_client_id and is_active = true;
  delete from public.employee_client_assignments where client_id = target_client_id;
  insert into public.employee_client_assignments (client_id, employee_user_id, is_active, assigned_by, assigned_at)
  values (target_client_id, target_employee_user_id, true, actor_user_id, now())
  on conflict (employee_user_id, client_id) do update set is_active = true, assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_user_id, 'Transferred client', 'Client', target_client_id, jsonb_build_object('employeeIds', previous_employee_ids), jsonb_build_object('employeeId', target_employee_user_id));
  return jsonb_build_object('clientId', target_client_id, 'employeeId', target_employee_user_id);
end;
$$;

create or replace function public.transfer_employee_client_assignment(target_client_id uuid, target_employee_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$ select private.transfer_employee_client_assignment(target_client_id, target_employee_user_id, auth.uid()); $$;

create or replace function private.set_employee_permission_override(
  target_employee_user_id uuid,
  target_permission_key text,
  target_mode text,
  actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare previous_mode text;
begin
  if not private.is_super_admin() then raise exception 'super_admin_required'; end if;
  if target_mode not in ('inherit', 'grant', 'revoke') then raise exception 'invalid_mode'; end if;
  if not exists (select 1 from public.permissions where permission_key = target_permission_key and panel = 'admin' and assignable_to_employee = true) then raise exception 'permission_not_assignable'; end if;
  select mode into previous_mode from public.employee_permission_overrides where employee_user_id = target_employee_user_id and permission_key = target_permission_key;
  delete from public.employee_permission_overrides where employee_user_id = target_employee_user_id and permission_key = target_permission_key;
  if target_mode <> 'inherit' then
    insert into public.employee_permission_overrides (employee_user_id, permission_key, mode, assigned_by)
    values (target_employee_user_id, target_permission_key, target_mode, actor_user_id);
  end if;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (actor_user_id, case when target_mode = 'inherit' then 'Removed employee permission override' when target_mode = 'grant' then 'Granted employee permission' else 'Revoked employee permission' end, 'Employee', target_employee_user_id, jsonb_build_object('permissionKey', target_permission_key, 'mode', previous_mode), jsonb_build_object('permissionKey', target_permission_key, 'mode', target_mode));
end;
$$;

create or replace function public.set_employee_permission_override(target_employee_user_id uuid, target_permission_key text, target_mode text)
returns void
language sql
security invoker
set search_path = public, private
as $$ select private.set_employee_permission_override(target_employee_user_id, target_permission_key, target_mode, auth.uid()); $$;

revoke all on function private.transfer_employee_client_assignment(uuid, uuid, uuid) from public, anon;
revoke all on function private.set_employee_permission_override(uuid, text, text, uuid) from public, anon;
revoke all on function public.transfer_employee_client_assignment(uuid, uuid) from public, anon;
revoke all on function public.set_employee_permission_override(uuid, text, text) from public, anon;
grant execute on function public.transfer_employee_client_assignment(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_employee_permission_override(uuid, text, text) to authenticated, service_role;
