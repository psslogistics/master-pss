-- Return the KYC-specific assignment error for an existing on-hold client.
-- The previous ordering treated every non-active client as not found, which
-- obscured the onboarding gate in the Super Admin UI.

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
  if not exists (select 1 from public.client_accounts where id = target_client_id) then
    raise exception 'client_not_found';
  end if;
  if not exists (select 1 from public.client_kyc_profiles where client_id = target_client_id and status = 'approved') then
    raise exception 'client_kyc_not_approved';
  end if;
  if not exists (select 1 from public.client_accounts where id = target_client_id and status = 'active') then
    raise exception 'client_not_active';
  end if;
  if not exists (
    select 1
      from public.employee_profiles ep
      join public.profiles p on p.id = ep.user_id
     where ep.user_id = target_employee_user_id
       and ep.employment_status = 'active'
       and p.status = 'active'
  ) then
    raise exception 'employee_not_active';
  end if;
  select coalesce(array_agg(employee_user_id), '{}'::uuid[])
    into previous_employee_ids
    from public.employee_client_assignments
   where client_id = target_client_id and is_active = true;
  delete from public.employee_client_assignments where client_id = target_client_id;
  insert into public.employee_client_assignments (client_id, employee_user_id, is_active, assigned_by, assigned_at)
  values (target_client_id, target_employee_user_id, true, actor_user_id, now())
  on conflict (employee_user_id, client_id) do update
    set is_active = true, assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at;
  insert into public.admin_audit_events (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (
    actor_user_id,
    'Transferred client',
    'Client',
    target_client_id,
    jsonb_build_object('employeeIds', previous_employee_ids),
    jsonb_build_object('employeeId', target_employee_user_id)
  );
  return jsonb_build_object('clientId', target_client_id, 'employeeId', target_employee_user_id);
end;
$$;

revoke all on function private.transfer_employee_client_assignment(uuid, uuid, uuid) from public, anon;
grant execute on function private.transfer_employee_client_assignment(uuid, uuid, uuid) to authenticated, service_role;
