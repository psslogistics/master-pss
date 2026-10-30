alter table public.client_accounts
  add column if not exists identity_environment text not null default 'production';

alter table public.client_accounts
  drop constraint if exists client_accounts_identity_environment_check;

alter table public.client_accounts
  add constraint client_accounts_identity_environment_check
  check (identity_environment in ('production', 'test', 'unclassified'));

-- Classify QA organizations through the audited Super Admin workflow instead
-- of inferring a client environment from a user's email or membership.
