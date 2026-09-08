-- Shared Auth/RBAC hardening. This migration is additive and preserves all rows.

-- Keep the database permission catalogue aligned with the Master control-plane
-- permission model. Existing permission rows are preserved.
insert into public.permissions (permission_key, label, description, permission_group)
values
  ('analytics.view', 'View analytics', 'Review organization operational analytics.', 'Insights'),
  ('api_keys.view', 'View API keys', 'Review external credentials and webhook endpoints.', 'Platform'),
  ('automation.view', 'View automation', 'Review workflow rules and scheduled jobs.', 'Platform'),
  ('departments.view', 'View departments', 'Review department structure and capacity.', 'Organization'),
  ('exceptions.view', 'View exceptions', 'Review operational holds, delays, and failures.', 'Operations'),
  ('integrations.view', 'View integrations', 'Review courier and communication integrations.', 'Platform'),
  ('performance.view', 'View performance', 'Review operational scorecards.', 'Insights'),
  ('shipments.export', 'Export shipments', 'Export operational shipment data.', 'Operations'),
  ('wallet.view', 'View wallets', 'Review client wallet balances and adjustments.', 'Finance')
on conflict (permission_key) do nothing;

create index if not exists user_roles_role_id_idx
  on public.user_roles (role_id);

create index if not exists role_permissions_permission_key_idx
  on public.role_permissions (permission_key);

create index if not exists employee_client_assignments_client_id_idx
  on public.employee_client_assignments (client_id);

create index if not exists client_memberships_client_id_idx
  on public.client_memberships (client_id);

create index if not exists employee_profiles_status_idx
  on public.employee_profiles (employment_status);

-- Keep the exposed shared tables protected if a project was created before the
-- foundation migration was fully applied.
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.client_accounts enable row level security;
alter table public.client_memberships enable row level security;
alter table public.employee_client_assignments enable row level security;
