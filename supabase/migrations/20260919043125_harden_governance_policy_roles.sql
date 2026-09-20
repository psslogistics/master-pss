-- Governance and identity policies never need to be evaluated for anonymous
-- requests. Keep the existing predicates and narrow their role to authenticated.

ALTER POLICY admin_audit_events_insert ON public.admin_audit_events TO authenticated;
ALTER POLICY client_accounts_admin_write ON public.client_accounts TO authenticated;
ALTER POLICY client_accounts_scope_read ON public.client_accounts TO authenticated;
ALTER POLICY client_memberships_admin_write ON public.client_memberships TO authenticated;
ALTER POLICY client_memberships_scope_read ON public.client_memberships TO authenticated;
ALTER POLICY employee_assignments_admin_write ON public.employee_client_assignments TO authenticated;
ALTER POLICY employee_assignments_scope_read ON public.employee_client_assignments TO authenticated;
ALTER POLICY employee_permission_overrides_read ON public.employee_permission_overrides TO authenticated;
ALTER POLICY employee_profiles_admin_write ON public.employee_profiles TO authenticated;
ALTER POLICY employee_profiles_scope_read ON public.employee_profiles TO authenticated;
ALTER POLICY profiles_self_or_admin ON public.profiles TO authenticated;
ALTER POLICY profiles_self_update ON public.profiles TO authenticated;
ALTER POLICY role_permissions_admin_write ON public.role_permissions TO authenticated;
ALTER POLICY roles_admin_write ON public.roles TO authenticated;
ALTER POLICY user_roles_admin_write ON public.user_roles TO authenticated;
ALTER POLICY user_roles_self_or_admin ON public.user_roles TO authenticated;
