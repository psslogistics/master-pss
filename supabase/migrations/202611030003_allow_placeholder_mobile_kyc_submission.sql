-- Allow the current placeholder-mobile flow to submit KYC for review.
-- Submission records the supplied mobile number; approval and provider booking
-- remain gated by phone_verified_at in the review/booking authorization paths.

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

  select * into target
    from public.client_kyc_profiles
   where client_id = target_client;

  if target.client_id is null then
    raise exception using errcode = '22023', message = 'Complete the mandatory KYC fields before submitting';
  end if;

  -- Mobile OTP is intentionally a placeholder at present. A real OTP is still
  -- required later by review_client_kyc and provider booking authorization.
  if nullif(btrim(target.gst_number), '') is null
     or nullif(btrim(target.pan_number), '') is null
     or target.aadhaar_last4 is null
     or nullif(btrim(target.mobile_number), '') is null then
    raise exception using errcode = '22023',
      message = 'GST, PAN, Aadhaar, and mobile number are required before submitting';
  end if;

  if (select count(*)
        from public.client_kyc_documents d
       where d.client_id = target_client
         and d.document_type in ('aadhaar', 'gst', 'pan')
         and d.status in ('submitted', 'approved')) <> 3 then
    raise exception using errcode = '22023', message = 'Upload Aadhaar, GST, and PAN documents before submitting';
  end if;

  update public.client_kyc_profiles
     set status = 'submitted',
         submitted_at = now(),
         reviewed_at = null,
         reviewed_by = null,
         review_notes = null,
         kyc_version = kyc_version + 1,
         updated_at = now()
   where client_id = target_client
   returning * into target;

  return target;
end;
$$;

revoke all on function public.submit_client_kyc() from public;
revoke execute on function public.submit_client_kyc() from anon;
grant execute on function public.submit_client_kyc() to authenticated;
