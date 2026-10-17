-- Conservative baseline grants for existing employee roles.
-- Sensitive shipment, POD, export, and weight-resolution permissions remain opt-in.

with baseline(role_code, permission_key) as (
  values
    ('operations_executive', 'admin.shipments.assigned.view'),
    ('operations_executive', 'admin.exceptions.view'),
    ('sanjay', 'admin.shipments.assigned.view'),
    ('client_relationship_manager', 'admin.shipments.assigned.view'),
    ('support_executive', 'admin.shipments.assigned.view'),
    ('finance_executive', 'admin.weight.view')
)
insert into public.role_permissions (role_id, permission_key)
select r.id, b.permission_key
from baseline b
join public.roles r on r.role_code = b.role_code and r.scope = 'employee'
join public.permissions p on p.permission_key = b.permission_key and p.panel = 'admin' and p.assignable_to_employee = true
on conflict (role_id, permission_key) do nothing;

