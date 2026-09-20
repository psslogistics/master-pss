-- Avoid making ALL admin policies participate in SELECT evaluation. Read
-- access remains owned by the existing scope/read policies below.

DROP POLICY client_accounts_admin_write ON public.client_accounts;
CREATE POLICY client_accounts_admin_insert ON public.client_accounts FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY client_accounts_admin_update ON public.client_accounts FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY client_accounts_admin_delete ON public.client_accounts FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY client_memberships_admin_write ON public.client_memberships;
CREATE POLICY client_memberships_admin_insert ON public.client_memberships FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY client_memberships_admin_update ON public.client_memberships FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY client_memberships_admin_delete ON public.client_memberships FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY employee_assignments_admin_write ON public.employee_client_assignments;
CREATE POLICY employee_assignments_admin_insert ON public.employee_client_assignments FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY employee_assignments_admin_update ON public.employee_client_assignments FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY employee_assignments_admin_delete ON public.employee_client_assignments FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY employee_permission_overrides_admin_write ON public.employee_permission_overrides;
CREATE POLICY employee_permission_overrides_admin_insert ON public.employee_permission_overrides FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY employee_permission_overrides_admin_update ON public.employee_permission_overrides FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY employee_permission_overrides_admin_delete ON public.employee_permission_overrides FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY employee_profiles_admin_write ON public.employee_profiles;
CREATE POLICY employee_profiles_admin_insert ON public.employee_profiles FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY employee_profiles_admin_update ON public.employee_profiles FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY employee_profiles_admin_delete ON public.employee_profiles FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY rate_cards_write_scope ON public.rate_cards;
CREATE POLICY rate_cards_write_insert ON public.rate_cards FOR INSERT TO authenticated WITH CHECK (is_super_admin() OR (has_permission('admin.rate_cards.manage') AND is_employee_assigned(client_id)));
CREATE POLICY rate_cards_write_update ON public.rate_cards FOR UPDATE TO authenticated USING (is_super_admin() OR (has_permission('admin.rate_cards.manage') AND is_employee_assigned(client_id))) WITH CHECK (is_super_admin() OR (has_permission('admin.rate_cards.manage') AND is_employee_assigned(client_id)));
CREATE POLICY rate_cards_write_delete ON public.rate_cards FOR DELETE TO authenticated USING (is_super_admin() OR (has_permission('admin.rate_cards.manage') AND is_employee_assigned(client_id)));

DROP POLICY role_permissions_admin_write ON public.role_permissions;
CREATE POLICY role_permissions_admin_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY role_permissions_admin_update ON public.role_permissions FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY role_permissions_admin_delete ON public.role_permissions FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY roles_admin_write ON public.roles;
CREATE POLICY roles_admin_insert ON public.roles FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY roles_admin_update ON public.roles FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY roles_admin_delete ON public.roles FOR DELETE TO authenticated USING (is_super_admin());

DROP POLICY user_roles_admin_write ON public.user_roles;
CREATE POLICY user_roles_admin_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_super_admin());
CREATE POLICY user_roles_admin_update ON public.user_roles FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY user_roles_admin_delete ON public.user_roles FOR DELETE TO authenticated USING (is_super_admin());
