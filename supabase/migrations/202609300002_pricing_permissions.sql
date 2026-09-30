-- Delhivery B2B PSS pricing permissions. Publication and provider-cost access
-- remain Super Admin capabilities; these keys make the decisions explicit and
-- auditable for the shared RBAC catalogue.
INSERT INTO public.permissions
  (permission_key, label, description, permission_group, panel, resource, action, route, assignable_to_employee)
VALUES
  ('admin.pricing.view', 'View client pricing', 'View client-scoped PSS Delhivery B2B pricing configuration.', 'Pricing', 'admin', 'pricing', 'view', '/pricing', false),
  ('admin.pricing.manage', 'Manage client pricing', 'Create and edit draft PSS Delhivery B2B pricing versions.', 'Pricing', 'admin', 'pricing', 'manage', '/pricing', false),
  ('admin.pricing.publish', 'Publish client pricing', 'Publish a validated PSS Delhivery B2B pricing version.', 'Pricing', 'admin', 'pricing', 'publish', '/pricing', false),
  ('admin.pricing.override', 'Override shipment pricing', 'Apply an audited client-facing shipment pricing override.', 'Pricing', 'admin', 'pricing', 'override', '/pricing', false),
  ('admin.provider_cost.view', 'View provider cost and margin', 'View internal Delhivery cost and margin data.', 'Pricing', 'admin', 'provider_cost', 'view', '/pricing', false)
ON CONFLICT (permission_key) DO UPDATE SET
  label = excluded.label,
  description = excluded.description,
  permission_group = excluded.permission_group,
  panel = excluded.panel,
  resource = excluded.resource,
  action = excluded.action,
  route = excluded.route,
  assignable_to_employee = excluded.assignable_to_employee;
