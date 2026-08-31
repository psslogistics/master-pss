create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  phone text,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'suspended', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  role_code text unique not null,
  name text not null,
  description text,
  scope text not null check (scope in ('system', 'employee', 'client')),
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.permissions (
  permission_key text primary key,
  label text not null,
  description text,
  permission_group text
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  primary key (role_id, permission_key)
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  is_active boolean not null default true,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.employee_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  employee_code text unique not null,
  department text,
  workspace_slug text unique,
  employment_status text not null default 'active' check (employment_status in ('active', 'invited', 'disabled')),
  joined_at date,
  last_active_at timestamptz
);

create table if not exists public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  client_code text unique not null,
  legal_name text not null,
  status text not null default 'active' check (status in ('active', 'on_hold', 'disabled')),
  created_at timestamptz not null default now()
);

create table if not exists public.client_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.client_accounts(id) on delete cascade,
  membership_status text not null default 'active' check (membership_status in ('active', 'suspended')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create table if not exists public.employee_client_assignments (
  employee_user_id uuid not null references public.employee_profiles(user_id) on delete cascade,
  client_id uuid not null references public.client_accounts(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (employee_user_id, client_id)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_client_id uuid;
  client_role_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do update set email = excluded.email, updated_at = now();
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'client' then
    insert into public.client_accounts (client_code, legal_name)
    values ('CL-' || upper(substr(replace(new.id::text, '-', ''), 1, 8)), coalesce(new.raw_user_meta_data ->> 'company_name', 'New client'))
    returning id into new_client_id;
    insert into public.client_memberships (user_id, client_id, is_primary)
    values (new.id, new_client_id, true);
    select id into client_role_id from public.roles where role_code = 'client_user';
    insert into public.user_roles (user_id, role_id) values (new.id, client_role_id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.is_active and r.role_code = 'super_admin' and p.status = 'active'
  );
$$;

create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and ur.is_active and p.status = 'active' and rp.permission_key = required_permission
  );
$$;

create or replace function public.is_client_member(target_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.client_memberships cm where cm.user_id = auth.uid() and cm.client_id = target_client and cm.membership_status = 'active');
$$;

create or replace function public.is_employee_assigned(target_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employee_client_assignments eca where eca.employee_user_id = auth.uid() and eca.client_id = target_client);
$$;

insert into public.roles (role_code, name, description, scope) values
  ('super_admin', 'Super Admin', 'Unrestricted organization control.', 'system'),
  ('operations_executive', 'Operations Executive', 'Bookings, tracking, pickups, and assigned clients.', 'employee'),
  ('client_relationship_manager', 'Client Relationship Manager', 'Client ownership and support coordination.', 'employee'),
  ('finance_executive', 'Finance Executive', 'Billing, invoices, and finance reporting.', 'employee'),
  ('support_executive', 'Support Executive', 'Assigned support queue and client response.', 'employee'),
  ('client_user', 'Client User', 'Access to the client workspace.', 'client')
on conflict (role_code) do nothing;

insert into public.permissions (permission_key, label, permission_group) values
  ('dashboard.view', 'View dashboard', 'Overview'), ('alerts.view', 'View alerts', 'Overview'),
  ('clients.view', 'View clients', 'Clients'), ('clients.create', 'Create clients', 'Clients'), ('clients.edit', 'Edit clients', 'Clients'), ('clients.assign', 'Assign clients', 'Clients'),
  ('crm.view', 'View CRM', 'CRM'), ('crm.manage', 'Manage CRM', 'CRM'),
  ('shipments.view', 'View shipments', 'Operations'), ('shipments.create', 'Create shipments', 'Operations'), ('shipments.edit', 'Edit shipments', 'Operations'), ('tracking.view', 'View tracking', 'Operations'), ('tracking.update', 'Update tracking', 'Operations'), ('pickup.view', 'View pickups', 'Operations'), ('pickup.create', 'Create pickups', 'Operations'), ('returns.view', 'View returns', 'Operations'),
  ('tickets.view', 'View tickets', 'Support'), ('tickets.reply', 'Reply to tickets', 'Support'), ('tickets.close', 'Close tickets', 'Support'), ('tickets.reassign', 'Reassign tickets', 'Support'),
  ('billing.view', 'View billing', 'Finance'), ('billing.create', 'Create invoices', 'Finance'), ('billing.approve', 'Approve billing', 'Finance'), ('transactions.view', 'View transactions', 'Finance'),
  ('reports.view', 'View reports', 'Insights'), ('reports.export', 'Export reports', 'Insights'),
  ('employees.view', 'View employees', 'Organization'), ('employees.create', 'Create employees', 'Organization'), ('employees.edit', 'Edit employees', 'Organization'), ('employees.disable', 'Disable employees', 'Organization'), ('roles.view', 'View roles', 'Organization'), ('roles.manage', 'Manage roles', 'Organization'), ('tasks.view', 'View tasks', 'Organization'), ('employee_activity.view', 'View employee activity', 'Organization'),
  ('security.view', 'View security', 'System'), ('notifications.view', 'View notifications', 'System'), ('settings.view', 'View settings', 'System'), ('audit.view', 'View audit log', 'System'), ('profile.view', 'View profile', 'Account'),
  ('booking.view', 'View booking', 'Operations'), ('booking.create', 'Create booking', 'Operations'), ('pickup.assign', 'Assign pickups', 'Operations'), ('tickets.manage', 'Manage tickets', 'Support')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.permission_key from public.roles r cross join public.permissions p where r.role_code = 'super_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, x.permission_key
from public.roles r
join (values
  ('operations_executive', 'dashboard.view'), ('operations_executive', 'clients.view'), ('operations_executive', 'shipments.view'), ('operations_executive', 'shipments.create'), ('operations_executive', 'shipments.edit'), ('operations_executive', 'tracking.view'), ('operations_executive', 'tracking.update'), ('operations_executive', 'pickup.view'), ('operations_executive', 'pickup.create'), ('operations_executive', 'tickets.view'), ('operations_executive', 'tickets.reply'), ('operations_executive', 'tickets.close'),
  ('client_relationship_manager', 'dashboard.view'), ('client_relationship_manager', 'clients.view'), ('client_relationship_manager', 'clients.create'), ('client_relationship_manager', 'clients.edit'), ('client_relationship_manager', 'crm.view'), ('client_relationship_manager', 'crm.manage'), ('client_relationship_manager', 'tickets.view'), ('client_relationship_manager', 'tickets.reply'), ('client_relationship_manager', 'tickets.close'), ('client_relationship_manager', 'reports.view'),
  ('finance_executive', 'dashboard.view'), ('finance_executive', 'clients.view'), ('finance_executive', 'billing.view'), ('finance_executive', 'billing.create'), ('finance_executive', 'reports.view'), ('finance_executive', 'reports.export'),
  ('support_executive', 'dashboard.view'), ('support_executive', 'clients.view'), ('support_executive', 'tickets.view'), ('support_executive', 'tickets.reply'), ('support_executive', 'tickets.close')
) as x(role_code, permission_key) on x.role_code = r.role_code
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.permission_key from public.roles r cross join public.permissions p
where r.role_code = 'client_user' and p.permission_key in ('profile.view', 'dashboard.view', 'tracking.view', 'booking.view', 'booking.create', 'pickup.view', 'reports.view', 'billing.view', 'transactions.view', 'tickets.view', 'tickets.reply', 'notifications.view', 'settings.view')
on conflict do nothing;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.employee_profiles enable row level security;
alter table public.client_accounts enable row level security;
alter table public.client_memberships enable row level security;
alter table public.employee_client_assignments enable row level security;

drop policy if exists profiles_self_or_admin on public.profiles;
create policy profiles_self_or_admin on public.profiles for select using (id = auth.uid() or public.is_super_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update (id, email, status, created_at, updated_at) on public.profiles from authenticated;
grant update (display_name, phone, avatar_url) on public.profiles to authenticated;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles for select to authenticated using (true);
drop policy if exists permissions_authenticated_read on public.permissions;
create policy permissions_authenticated_read on public.permissions for select to authenticated using (true);
drop policy if exists role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_authenticated_read on public.role_permissions for select to authenticated using (true);

drop policy if exists user_roles_self_or_admin on public.user_roles;
create policy user_roles_self_or_admin on public.user_roles for select using (user_id = auth.uid() or public.is_super_admin());
drop policy if exists user_roles_admin_write on public.user_roles;
create policy user_roles_admin_write on public.user_roles for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists roles_admin_write on public.roles;
create policy roles_admin_write on public.roles for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists role_permissions_admin_write on public.role_permissions;
create policy role_permissions_admin_write on public.role_permissions for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists employee_profiles_scope_read on public.employee_profiles;
create policy employee_profiles_scope_read on public.employee_profiles for select using (user_id = auth.uid() or public.has_permission('employees.view'));
drop policy if exists employee_profiles_admin_write on public.employee_profiles;
create policy employee_profiles_admin_write on public.employee_profiles for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists client_accounts_scope_read on public.client_accounts;
create policy client_accounts_scope_read on public.client_accounts for select using (public.is_super_admin() or public.is_client_member(id) or public.is_employee_assigned(id));
drop policy if exists client_accounts_admin_write on public.client_accounts;
create policy client_accounts_admin_write on public.client_accounts for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists client_memberships_scope_read on public.client_memberships;
create policy client_memberships_scope_read on public.client_memberships for select using (user_id = auth.uid() or public.is_super_admin());
drop policy if exists client_memberships_admin_write on public.client_memberships;
create policy client_memberships_admin_write on public.client_memberships for all using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists employee_assignments_scope_read on public.employee_client_assignments;
create policy employee_assignments_scope_read on public.employee_client_assignments for select using (employee_user_id = auth.uid() or public.is_super_admin());
drop policy if exists employee_assignments_admin_write on public.employee_client_assignments;
create policy employee_assignments_admin_write on public.employee_client_assignments for all using (public.is_super_admin()) with check (public.is_super_admin());
