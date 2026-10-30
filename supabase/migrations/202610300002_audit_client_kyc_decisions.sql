-- Record KYC review decisions in the same transaction as the profile and
-- document updates. Keep government identifiers, phone numbers, and free-text
-- review notes out of the audit payload.
create or replace function public.review_client_kyc(
  p_client_id uuid,
  p_status text,
  p_review_notes text default null,
  p_gst_number text default null,
  p_pan_number text default null,
  p_aadhaar_last4 text default null
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

  select status into previous_status
    from public.client_kyc_profiles
   where client_id = p_client_id
   for update;
  if previous_status is null then
    raise exception using errcode = '22023', message = 'KYC record not found';
  end if;

  select coalesce(jsonb_object_agg(document_type, status), '{}'::jsonb)
    into previous_document_states
    from public.client_kyc_documents
   where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');

  if p_status = 'approved' then
    if nullif(btrim(coalesce(p_gst_number, '')), '') is null
      or nullif(btrim(coalesce(p_pan_number, '')), '') is null
      or coalesce(p_aadhaar_last4, '') !~ '^[0-9]{4}$' then
      raise exception using errcode = '22023', message = 'GST, PAN, and Aadhaar are mandatory for approval';
    end if;
    if not exists (
      select 1 from public.client_kyc_profiles
       where client_id = p_client_id and phone_verified_at is not null
    ) then
      raise exception using errcode = '22023', message = 'Mobile OTP verification is required before approval';
    end if;
    select count(*) into document_count
      from public.client_kyc_documents
     where client_id = p_client_id
       and document_type in ('aadhaar', 'gst', 'pan')
       and status in ('submitted', 'approved');
    if document_count <> 3 then
      raise exception using errcode = '22023', message = 'Aadhaar, GST, and PAN documents are required before approval';
    end if;
  end if;

  update public.client_kyc_profiles
     set status = p_status,
         gst_number = coalesce(nullif(btrim(p_gst_number), ''), gst_number),
         pan_number = coalesce(nullif(btrim(p_pan_number), ''), pan_number),
         aadhaar_last4 = coalesce(nullif(btrim(p_aadhaar_last4), ''), aadhaar_last4),
         reviewed_at = now(),
         reviewed_by = auth.uid(),
         review_notes = nullif(btrim(p_review_notes), ''),
         updated_at = now()
   where client_id = p_client_id
   returning * into result_row;

  update public.client_kyc_documents
     set status = case when p_status = 'approved' then 'approved' else p_status end,
         reviewed_by = auth.uid(),
         review_note = p_review_notes,
         updated_at = now()
   where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');

  select coalesce(jsonb_object_agg(document_type, status), '{}'::jsonb)
    into next_document_states
    from public.client_kyc_documents
   where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');

  insert into public.admin_audit_events (
    actor_user_id, action, entity_type, entity_id, before_state, after_state
  ) values (
    auth.uid(),
    'KYC decision: ' || replace(p_status, '_', ' '),
    'Client KYC',
    p_client_id::text,
    jsonb_build_object('status', previous_status, 'document_statuses', previous_document_states),
    jsonb_build_object('status', p_status, 'document_statuses', next_document_states)
  );

  return result_row;
end;
$$;

revoke all on function public.review_client_kyc(uuid, text, text, text, text, text) from public;
revoke execute on function public.review_client_kyc(uuid, text, text, text, text, text) from anon;
grant execute on function public.review_client_kyc(uuid, text, text, text, text, text) to authenticated;
