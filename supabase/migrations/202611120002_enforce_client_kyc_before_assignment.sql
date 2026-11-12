-- Enforce the onboarding invariant at the database boundary.
-- New active employee ownership is allowed only after client KYC approval.
-- Deactivation remains allowed so legacy invalid rows can be safely remediated.

create or replace function private.enforce_client_kyc_before_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.is_active = true
     and not exists (
       select 1
         from public.client_kyc_profiles
        where client_id = new.client_id
          and status = 'approved'
     ) then
    raise exception 'client_kyc_not_approved';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_client_kyc_before_assignment() from public;

drop trigger if exists employee_assignment_requires_approved_kyc
  on public.employee_client_assignments;
create constraint trigger employee_assignment_requires_approved_kyc
after insert or update of client_id, is_active
on public.employee_client_assignments
deferrable initially immediate
for each row
execute function private.enforce_client_kyc_before_assignment();

