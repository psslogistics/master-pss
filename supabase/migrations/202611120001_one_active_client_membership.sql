-- A client portal user must have at most one active workspace.
-- Multiple active memberships otherwise leave the user in the access-pending
-- / multiple-workspaces state and make workspace selection ambiguous.

begin;

-- Preserve the preferred workspace for existing duplicate rows. Prefer an
-- explicitly primary membership, then the most recently assigned membership,
-- then the oldest row as a deterministic final tie-breaker. Suspended rows are
-- retained for audit/history rather than deleted.
with ranked_active_memberships as (
  select
    ctid,
    row_number() over (
      partition by user_id
      order by is_primary desc, assigned_at desc nulls last, created_at asc, client_id
    ) as membership_rank
  from public.client_memberships
  where membership_status = 'active'
)
update public.client_memberships cm
   set membership_status = 'suspended',
       is_primary = false
 where cm.ctid in (
   select ctid
   from ranked_active_memberships
   where membership_rank > 1
 );

-- The authoritative guard for all future inserts and updates, regardless of
-- whether they originate in onboarding, an admin workflow, or a direct call.
create unique index if not exists client_memberships_one_active_user_idx
  on public.client_memberships (user_id)
  where membership_status = 'active';

commit;
