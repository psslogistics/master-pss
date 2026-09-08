-- Access hardening for identity administration. Additive and data-preserving.

create table if not exists public.employee_permission_overrides (
  employee_user_id uuid not null references public.employee_profiles(user_id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  mode text not null check (mode in ('grant', 'revoke')),
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (employee_user_id, permission_key)
);
alter table public.employee_permission_overrides enable row level security;
drop policy if exists employee_permission_overrides_read on public.employee_permission_overrides;
create policy employee_permission_overrides_read on public.employee_permission_overrides for select to authenticated using (employee_user_id = auth.uid() or public.is_super_admin());
drop policy if exists employee_permission_overrides_admin_write on public.employee_permission_overrides;
create policy employee_permission_overrides_admin_write on public.employee_permission_overrides for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_events enable row level security;
drop policy if exists admin_audit_events_read on public.admin_audit_events;
create policy admin_audit_events_read on public.admin_audit_events for select to authenticated using (public.is_super_admin());
drop policy if exists admin_audit_events_insert on public.admin_audit_events;
create policy admin_audit_events_insert on public.admin_audit_events for insert to authenticated with check (actor_user_id = auth.uid() and public.is_super_admin());

create or replace function public.complete_password_change()
returns void language sql security definer set search_path = public
as $$ update public.profiles set must_change_password = false, updated_at = now() where id = auth.uid() and status = 'active'; $$;

create or replace function public.is_client_member(target_client uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.client_memberships cm join public.profiles p on p.id = cm.user_id where cm.user_id = auth.uid() and p.status = 'active' and cm.client_id = target_client and cm.membership_status = 'active'); $$;

create or replace function public.is_employee_assigned(target_client uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.employee_client_assignments eca join public.profiles p on p.id = eca.employee_user_id join public.employee_profiles ep on ep.user_id = eca.employee_user_id where eca.employee_user_id = auth.uid() and p.status = 'active' and ep.employment_status = 'active' and eca.client_id = target_client); $$;

revoke all on function public.complete_password_change() from anon;
revoke all on function public.complete_password_change() from authenticated;
grant execute on function public.complete_password_change() to authenticated;
revoke all on function public.is_client_member(uuid) from anon;
revoke all on function public.is_employee_assigned(uuid) from anon;
revoke all on function public.is_super_admin() from anon;
revoke all on function public.has_permission(text) from anon;
revoke all on function public.generate_employee_code() from anon;

-- Client users may edit only their personal profile fields through the Data API.
revoke update on table public.profiles from authenticated;
grant update (display_name, phone, company_name, avatar_url) on table public.profiles to authenticated;
