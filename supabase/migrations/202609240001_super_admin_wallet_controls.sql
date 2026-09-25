-- Make Super Admin wallet controls explicit in the shared permission catalogue.
-- This is additive and preserves existing roles, transactions, and balances.

insert into public.permissions (
  permission_key,
  label,
  description,
  permission_group,
  panel,
  assignable_to_employee
)
values
  (
    'wallet.manage',
    'Manage wallets',
    'Create and approve client wallet credit and debit adjustments.',
    'Finance',
    'shared',
    false
  )
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.permission_key
from public.roles r
cross join public.permissions p
where r.role_code = 'super_admin'
  and p.permission_key in ('wallet.view', 'wallet.manage')
on conflict do nothing;
