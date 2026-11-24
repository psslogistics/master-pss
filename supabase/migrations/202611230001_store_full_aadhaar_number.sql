-- Replace the four-digit Aadhaar placeholder with the complete 12-digit value.
-- Keep aadhaar_last4 for backwards-compatible reads during rollout; all new
-- writes, review decisions, and booking gates use aadhaar_number.
alter table public.client_kyc_profiles
  add column if not exists aadhaar_number text;

alter table public.client_kyc_profiles
  drop constraint if exists client_kyc_profiles_aadhaar_number_check;

alter table public.client_kyc_profiles
  add constraint client_kyc_profiles_aadhaar_number_check
  check (aadhaar_number is null or aadhaar_number ~ '^[0-9]{12}$') not valid;

grant update (gst_number, pan_number, aadhaar_number, mobile_number)
  on public.client_kyc_profiles to authenticated;

create or replace function public.submit_client_kyc()
returns public.client_kyc_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.client_kyc_profiles;
  target_client uuid;
begin
  select cm.client_id into target_client
    from public.client_memberships cm
   where cm.user_id = auth.uid() and cm.membership_status = 'active'
   order by cm.is_primary desc nulls last, cm.assigned_at asc
   limit 1;

  if target_client is null then
    raise exception using errcode = '42501', message = 'An active client assignment is required';
  end if;

  select * into target from public.client_kyc_profiles where client_id = target_client;
  if target.client_id is null then
    raise exception using errcode = '22023', message = 'Complete the mandatory KYC fields before submitting';
  end if;

  if nullif(btrim(target.gst_number), '') is null
     or nullif(btrim(target.pan_number), '') is null
     or coalesce(target.aadhaar_number, '') !~ '^[0-9]{12}$'
     or nullif(btrim(target.mobile_number), '') is null then
    raise exception using errcode = '22023', message = 'GST, PAN, full Aadhaar number, and mobile number are required before submitting';
  end if;

  if (select count(*) from public.client_kyc_documents d
      where d.client_id = target_client
        and d.document_type in ('aadhaar', 'gst', 'pan')
        and d.status in ('submitted', 'approved')) <> 3 then
    raise exception using errcode = '22023', message = 'Upload Aadhaar, GST, and PAN documents before submitting';
  end if;

  update public.client_kyc_profiles
     set status = 'submitted', submitted_at = now(), reviewed_at = null,
         reviewed_by = null, review_notes = null, kyc_version = kyc_version + 1,
         updated_at = now()
   where client_id = target_client
   returning * into target;
  return target;
end;
$$;

revoke all on function public.submit_client_kyc() from public;
revoke execute on function public.submit_client_kyc() from anon;
grant execute on function public.submit_client_kyc() to authenticated;

drop function if exists public.review_client_kyc(uuid, text, text, text, text, text);

create or replace function public.review_client_kyc(
  p_client_id uuid,
  p_status text,
  p_review_notes text default null,
  p_gst_number text default null,
  p_pan_number text default null,
  p_aadhaar_number text default null
)
returns public.client_kyc_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.client_kyc_profiles;
  previous_status text;
  previous_document_states jsonb;
  next_document_states jsonb;
  document_count integer;
begin
  if not public.is_super_admin() then
    raise exception using errcode = '42501', message = 'Only Super Admin can review client KYC';
  end if;
  if p_status not in ('approved', 'rejected', 'needs_changes', 'suspended') then
    raise exception using errcode = '22023', message = 'Invalid KYC review status';
  end if;
  select status into previous_status from public.client_kyc_profiles where client_id = p_client_id for update;
  if previous_status is null then
    raise exception using errcode = '22023', message = 'KYC record not found';
  end if;
  select coalesce(jsonb_object_agg(document_type, status), '{}'::jsonb)
    into previous_document_states from public.client_kyc_documents
   where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');

  if p_status = 'approved' then
    if nullif(btrim(coalesce(p_gst_number, '')), '') is null
       or nullif(btrim(coalesce(p_pan_number, '')), '') is null
       or coalesce(p_aadhaar_number, '') !~ '^[0-9]{12}$' then
      raise exception using errcode = '22023', message = 'GST, PAN, and full 12-digit Aadhaar number are mandatory for approval';
    end if;
    select count(*) into document_count from public.client_kyc_documents
     where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan')
       and status in ('submitted', 'approved');
    if document_count <> 3 then
      raise exception using errcode = '22023', message = 'Aadhaar, GST, and PAN documents are required before approval';
    end if;
  end if;

  update public.client_kyc_profiles
     set status = p_status,
         gst_number = coalesce(nullif(btrim(p_gst_number), ''), gst_number),
         pan_number = coalesce(nullif(btrim(p_pan_number), ''), pan_number),
         aadhaar_number = coalesce(nullif(btrim(p_aadhaar_number), ''), aadhaar_number),
         reviewed_at = now(), reviewed_by = auth.uid(),
         review_notes = nullif(btrim(p_review_notes), ''), updated_at = now()
   where client_id = p_client_id returning * into result_row;
  update public.client_kyc_documents
     set status = case when p_status = 'approved' then 'approved' else p_status end,
         reviewed_by = auth.uid(), review_note = p_review_notes, updated_at = now()
   where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');
  select coalesce(jsonb_object_agg(document_type, status), '{}'::jsonb)
    into next_document_states from public.client_kyc_documents
   where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');
  insert into public.admin_audit_events
    (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values
    (auth.uid(), 'KYC decision: ' || replace(p_status, '_', ' '), 'Client KYC', p_client_id::text,
     jsonb_build_object('status', previous_status, 'document_statuses', previous_document_states),
     jsonb_build_object('status', p_status, 'document_statuses', next_document_states));
  return result_row;
end;
$$;

revoke all on function public.review_client_kyc(uuid, text, text, text, text, text) from public;
revoke execute on function public.review_client_kyc(uuid, text, text, text, text, text) from anon;
grant execute on function public.review_client_kyc(uuid, text, text, text, text, text) to authenticated;
