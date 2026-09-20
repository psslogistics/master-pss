create index if not exists admin_audit_events_actor_user_id_idx on public.admin_audit_events (actor_user_id);
create index if not exists client_memberships_assigned_by_idx on public.client_memberships (assigned_by);
create index if not exists employee_client_assignments_assigned_by_idx on public.employee_client_assignments (assigned_by);
create index if not exists employee_permission_overrides_assigned_by_idx on public.employee_permission_overrides (assigned_by);
create index if not exists employee_permission_overrides_permission_key_idx on public.employee_permission_overrides (permission_key);
create index if not exists rate_cards_uploaded_by_idx on public.rate_cards (uploaded_by);
create index if not exists user_roles_assigned_by_idx on public.user_roles (assigned_by);
