-- Add the read/export capabilities needed for the assigned-client shipment register.
insert into public.permissions
  (permission_key, label, description, permission_group, panel, resource, action, route, assignable_to_employee)
values
  ('admin.shipments.view', 'View assigned shipments', 'View every shipment belonging to assigned clients.', 'Operations', 'admin', 'shipments', 'view', '/dashboard/shipments', true),
  ('admin.shipments.export', 'Export assigned shipments', 'Export shipment records belonging to assigned clients.', 'Operations', 'admin', 'shipments', 'export', '/dashboard/shipments', true)
on conflict (permission_key) do update set
  label = excluded.label,
  description = excluded.description,
  permission_group = excluded.permission_group,
  panel = excluded.panel,
  resource = excluded.resource,
  action = excluded.action,
  route = excluded.route,
  assignable_to_employee = excluded.assignable_to_employee;

-- Existing roles remain unchanged. Super Admin can explicitly grant these permissions.
