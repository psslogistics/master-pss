alter table public.employee_profiles
  add column if not exists identity_environment text not null default 'unclassified';

alter table public.employee_profiles
  drop constraint if exists employee_profiles_identity_environment_check;

alter table public.employee_profiles
  add constraint employee_profiles_identity_environment_check
  check (identity_environment in ('production', 'test', 'unclassified'));
