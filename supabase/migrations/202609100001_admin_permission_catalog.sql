-- Canonical, assignable permission catalogue for the Admin/Employee panel.
-- This migration is additive and preserves existing Client/Master permission keys.
alter table public.permissions
  add column if not exists panel text not null default 'shared',
  add column if not exists resource text,
  add column if not exists action text,
  add column if not exists route text,
  add column if not exists assignable_to_employee boolean not null default false;

insert into public.permissions
  (permission_key, label, description, permission_group, panel, resource, action, route, assignable_to_employee)
values
  ('admin.dashboard.view','View dashboard','Open the employee dashboard.','Overview','admin','dashboard','view','/dashboard',true),
  ('admin.clients.view','View assigned clients','View clients assigned to the employee.','My Work','admin','clients','view','/dashboard/myClients',true),
  ('admin.tasks.view','View tasks','View assigned employee tasks.','My Work','admin','tasks','view','/dashboard/myTasks',true),
  ('admin.tasks.manage','Manage tasks','Create, update, and complete employee tasks.','My Work','admin','tasks','manage','/dashboard/myTasks',true),
  ('admin.activity.view','View activity','View employee activity for assigned work.','My Work','admin','activity','view','/dashboard/myActivity',true),
  ('admin.booking.view','View booking','Open the booking workspace.','Operations','booking','view','/dashboard/booking',true),
  ('admin.booking.create','Create booking','Submit a shipment booking.','Operations','booking','create','/dashboard/booking',true),
  ('admin.tracking.view','View tracking','Open shipment tracking.','Operations','tracking','view','/dashboard/tracking',true),
  ('admin.tracking.update','Update tracking','Record an authorized tracking update.','Operations','tracking','update','/dashboard/tracking',true),
  ('admin.pickup.view','View pickups','Open pickup operations.','Operations','pickup','view','/dashboard/pickup',true),
  ('admin.pickup.create','Create pickups','Create a pickup request.','Operations','pickup','create','/dashboard/pickup',true),
  ('admin.pickup.assign','Assign pickups','Assign pickup responsibility.','Operations','pickup','assign','/dashboard/pickup',true),
  ('admin.reports.view','View reports','Open employee reports.','Operations','reports','view','/dashboard/reports',true),
  ('admin.reports.export','Export reports','Export permitted reports.','Operations','reports','export','/dashboard/reports',true),
  ('admin.rate_cards.view','View rate cards','View rate cards for assigned clients.','Operations','rate_cards','view','/dashboard/rate-cards',true),
  ('admin.rate_cards.manage','Manage rate cards','Upload or replace rate cards for assigned clients.','Operations','rate_cards','manage','/dashboard/rate-cards',true),
  ('admin.support.view','View support','Open assigned support tickets.','Account','admin','support','view','/dashboard/support',true),
  ('admin.tickets.create','Create tickets','Create a support ticket for an assigned client.','Account','admin','tickets','create','/dashboard/support',true),
  ('admin.tickets.reply','Reply to tickets','Reply to assigned support tickets.','Account','admin','tickets','reply','/dashboard/support',true),
  ('admin.tickets.close','Resolve tickets','Resolve or close support tickets.','Account','admin','tickets','close','/dashboard/support',true),
  ('admin.tickets.reassign','Reassign tickets','Transfer ticket responsibility.','Account','admin','tickets','reassign','/dashboard/support',true),
  ('admin.notifications.view','View notifications','View employee notifications.','Account','notifications','view','/dashboard/notifications',true),
  ('admin.profile.view','View profile','Open the employee profile.','Account','profile','view','/dashboard/profile',true),
  ('admin.profile.edit','Edit profile','Update permitted employee profile fields.','Account','profile','edit','/dashboard/profile',true),
  ('admin.settings.view','View settings','Open employee settings.','Account','settings','view','/dashboard/settings',true)
on conflict (permission_key) do update set
  label = excluded.label, description = excluded.description, permission_group = excluded.permission_group,
  panel = excluded.panel, resource = excluded.resource, action = excluded.action,
  route = excluded.route, assignable_to_employee = excluded.assignable_to_employee;

-- Move current employee role coverage to canonical Admin keys.
insert into public.role_permissions (role_id, permission_key)
select r.id, x.permission_key
from public.roles r
join (values
  ('dashboard.view','admin.dashboard.view'), ('clients.view','admin.clients.view'),
  ('booking.view','admin.booking.view'), ('booking.create','admin.booking.create'),
  ('tracking.view','admin.tracking.view'), ('tracking.update','admin.tracking.update'),
  ('pickup.view','admin.pickup.view'), ('pickup.create','admin.pickup.create'), ('pickup.assign','admin.pickup.assign'),
  ('reports.view','admin.reports.view'), ('reports.export','admin.reports.export'),
  ('tasks.view','admin.tasks.view'), ('tickets.view','admin.support.view'),
  ('tickets.reply','admin.tickets.reply'), ('tickets.close','admin.tickets.close'), ('tickets.reassign','admin.tickets.reassign'),
  ('employee_activity.view','admin.activity.view'), ('notifications.view','admin.notifications.view'),
  ('profile.view','admin.profile.view'), ('settings.view','admin.settings.view'), ('rate_cards.manage','admin.rate_cards.manage')
) as x(old_key, permission_key) on true
where r.scope = 'employee'
  and exists (select 1 from public.role_permissions old_link where old_link.role_id = r.id and old_link.permission_key = x.old_key)
on conflict do nothing;

-- Safe defaults for existing employee roles: profile editing follows profile
-- visibility, and rate-card viewing follows existing rate-card management.
insert into public.role_permissions (role_id, permission_key)
select r.id, 'admin.profile.edit'
from public.roles r
where r.scope = 'employee'
  and exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_key = 'admin.profile.view')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, 'admin.rate_cards.view'
from public.roles r
where r.scope = 'employee'
  and exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_key = 'admin.rate_cards.manage')
on conflict do nothing;

delete from public.role_permissions rp
using public.roles r
where rp.role_id = r.id and r.scope = 'employee'
  and rp.permission_key in ('activity.view','support.view');

-- One authorization decision for the Admin panel: active identity, active role,
-- active employment, role grants, and employee-specific overrides. A revoke wins.
create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    left join public.employee_profiles ep on ep.user_id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and p.status = 'active'
      and (r.scope = 'system' or (r.scope = 'employee' and ep.employment_status = 'active'))
      and (exists (select 1 from public.role_permissions rp where rp.role_id = ur.role_id and rp.permission_key = required_permission)
        or exists (select 1 from public.employee_permission_overrides e granting where granting.employee_user_id = ur.user_id and granting.permission_key = required_permission and granting.mode = 'grant'))
      and not exists (select 1 from public.employee_permission_overrides e revoking where revoking.employee_user_id = ur.user_id and revoking.permission_key = required_permission and revoking.mode = 'revoke')
  );
$$;

drop policy if exists rate_cards_read_scope on public.rate_cards;
create policy rate_cards_read_scope on public.rate_cards for select to authenticated using (public.is_super_admin() or (public.has_permission('admin.rate_cards.view') and public.is_employee_assigned(client_id)));
drop policy if exists rate_cards_write_scope on public.rate_cards;
create policy rate_cards_write_scope on public.rate_cards for all to authenticated using (public.is_super_admin() or (public.has_permission('admin.rate_cards.manage') and public.is_employee_assigned(client_id))) with check (public.is_super_admin() or (public.has_permission('admin.rate_cards.manage') and public.is_employee_assigned(client_id)));

-- Existing generic keys remain available to Client/Master flows; they are no longer
-- used by the Admin panel as permission aliases.
