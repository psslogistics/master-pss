-- Mandatory client KYC and verified mobile gate for shipment booking.
-- Client KYC is organization-scoped; users inherit the organization record
-- through client_memberships. Documents remain in a private Storage bucket.

create table if not exists public.client_kyc_profiles (
  client_id uuid primary key references public.client_accounts(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'draft', 'submitted', 'under_review', 'needs_changes', 'approved', 'rejected', 'suspended')),
  gst_number text,
  pan_number text,
  aadhaar_last4 text check (aadhaar_last4 is null or aadhaar_last4 ~ '^[0-9]{4}$'),
  mobile_number text,
  phone_verified_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_notes text,
  kyc_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_kyc_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client_accounts(id) on delete cascade,
  document_type text not null check (document_type in ('aadhaar', 'gst', 'pan', 'other')),
  object_path text not null,
  original_filename text not null,
  content_type text not null,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'needs_changes', 'rejected')),
  uploaded_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, document_type)
);

create index if not exists client_kyc_profiles_status_idx on public.client_kyc_profiles(status);
create index if not exists client_kyc_documents_client_idx on public.client_kyc_documents(client_id);

alter table public.client_kyc_profiles enable row level security;
alter table public.client_kyc_documents enable row level security;

drop policy if exists client_kyc_profiles_read on public.client_kyc_profiles;
create policy client_kyc_profiles_read on public.client_kyc_profiles
  for select to authenticated
  using (public.is_super_admin() or public.is_client_member(client_id) or public.is_employee_assigned(client_id));

drop policy if exists client_kyc_profiles_insert on public.client_kyc_profiles;
create policy client_kyc_profiles_insert on public.client_kyc_profiles
  for insert to authenticated
  with check (public.is_client_member(client_id) and status in ('not_started', 'draft'));

drop policy if exists client_kyc_profiles_update on public.client_kyc_profiles;
create policy client_kyc_profiles_update on public.client_kyc_profiles
  for update to authenticated
  using (public.is_super_admin() or public.is_client_member(client_id))
  with check (public.is_super_admin() or public.is_client_member(client_id));

drop policy if exists client_kyc_documents_read on public.client_kyc_documents;
create policy client_kyc_documents_read on public.client_kyc_documents
  for select to authenticated
  using (public.is_super_admin() or public.is_client_member(client_id));

drop policy if exists client_kyc_documents_insert on public.client_kyc_documents;
create policy client_kyc_documents_insert on public.client_kyc_documents
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_client_member(client_id) and status = 'submitted');

drop policy if exists client_kyc_documents_update on public.client_kyc_documents;
create policy client_kyc_documents_update on public.client_kyc_documents
  for update to authenticated
  using (public.is_super_admin() or (uploaded_by = auth.uid() and public.is_client_member(client_id)))
  with check (public.is_super_admin() or (uploaded_by = auth.uid() and public.is_client_member(client_id)));

grant select on public.client_kyc_profiles, public.client_kyc_documents to authenticated;
grant insert on public.client_kyc_profiles, public.client_kyc_documents to authenticated;
revoke update on public.client_kyc_profiles, public.client_kyc_documents from authenticated;
grant update (gst_number, pan_number, aadhaar_last4, mobile_number) on public.client_kyc_profiles to authenticated;
grant update (object_path, original_filename, content_type, uploaded_by) on public.client_kyc_documents to authenticated;

insert into storage.buckets (id, name, public)
values ('client-kyc-documents', 'client-kyc-documents', false)
on conflict (id) do update set public = false;

drop policy if exists client_kyc_storage_insert on storage.objects;
create policy client_kyc_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-kyc-documents'
    and public.is_client_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists client_kyc_storage_read on storage.objects;
create policy client_kyc_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-kyc-documents'
    and (public.is_super_admin() or public.is_client_member(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists client_kyc_storage_update on storage.objects;
create policy client_kyc_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'client-kyc-documents'
    and (public.is_super_admin() or public.is_client_member(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'client-kyc-documents'
    and (public.is_super_admin() or public.is_client_member(((storage.foldername(name))[1])::uuid))
  );

create or replace function public.mark_client_phone_verified()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_phone text;
  current_phone_confirmed_at timestamptz;
  target_client uuid;
begin
  select u.phone, u.phone_confirmed_at into current_phone, current_phone_confirmed_at from auth.users u join public.profiles p on p.id = u.id where u.id = auth.uid() and p.status = 'active';
  if current_phone is null or btrim(current_phone) = '' then
    raise exception using errcode = '22023', message = 'A mobile number is required before verification';
  end if;
  if current_phone_confirmed_at is null then
    raise exception using errcode = '42501', message = 'The mobile number must be verified by OTP first';
  end if;
  update public.profiles set phone = btrim(current_phone), updated_at = now() where id = auth.uid();
  select cm.client_id into target_client
    from public.client_memberships cm
   where cm.user_id = auth.uid() and cm.membership_status = 'active'
   order by cm.is_primary desc nulls last, cm.assigned_at asc
   limit 1;
  if target_client is null then
    raise exception using errcode = '42501', message = 'An active client assignment is required';
  end if;
  insert into public.client_kyc_profiles (client_id, mobile_number, phone_verified_at, status)
  values (target_client, btrim(current_phone), now(), 'draft')
  on conflict (client_id) do update set
    mobile_number = excluded.mobile_number,
    phone_verified_at = excluded.phone_verified_at,
    status = case when public.client_kyc_profiles.status = 'approved' then 'under_review' else public.client_kyc_profiles.status end,
    updated_at = now();
  return jsonb_build_object('client_id', target_client, 'phone_verified_at', now());
end;
$$;

revoke all on function public.mark_client_phone_verified() from public;
revoke execute on function public.mark_client_phone_verified() from anon;
grant execute on function public.mark_client_phone_verified() to authenticated;

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
  if target_client is null then raise exception using errcode = '42501', message = 'An active client assignment is required'; end if;
  select * into target from public.client_kyc_profiles where client_id = target_client;
  if target.client_id is null then raise exception using errcode = '22023', message = 'Complete the mandatory KYC fields before submitting'; end if;
  if nullif(btrim(target.gst_number), '') is null or nullif(btrim(target.pan_number), '') is null or target.aadhaar_last4 is null or target.phone_verified_at is null then
    raise exception using errcode = '22023', message = 'Approved submission requires GST, PAN, Aadhaar, and OTP-verified mobile number';
  end if;
  if (select count(*) from public.client_kyc_documents d where d.client_id = target_client and d.document_type in ('aadhaar', 'gst', 'pan') and d.status in ('submitted', 'approved')) <> 3 then
    raise exception using errcode = '22023', message = 'Upload Aadhaar, GST, and PAN documents before submitting';
  end if;
  update public.client_kyc_profiles
     set status = 'submitted', submitted_at = now(), reviewed_at = null, reviewed_by = null, review_notes = null, kyc_version = kyc_version + 1, updated_at = now()
   where client_id = target_client
   returning * into target;
  return target;
end;
$$;

revoke all on function public.submit_client_kyc() from public;
revoke execute on function public.submit_client_kyc() from anon;
grant execute on function public.submit_client_kyc() to authenticated;

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
declare result_row public.client_kyc_profiles;
begin
  if not public.is_super_admin() then raise exception using errcode = '42501', message = 'Only Super Admin can review client KYC'; end if;
  if p_status not in ('approved', 'rejected', 'needs_changes', 'suspended') then raise exception using errcode = '22023', message = 'Invalid KYC review status'; end if;
  if p_status = 'approved' and (nullif(btrim(coalesce(p_gst_number, '')), '') is null or nullif(btrim(coalesce(p_pan_number, '')), '') is null or coalesce(p_aadhaar_last4, '') !~ '^[0-9]{4}$') then
    raise exception using errcode = '22023', message = 'GST, PAN, and Aadhaar are mandatory for approval';
  end if;
  update public.client_kyc_profiles
     set status = p_status,
         gst_number = coalesce(nullif(btrim(p_gst_number), ''), gst_number),
         pan_number = coalesce(nullif(btrim(p_pan_number), ''), pan_number),
         aadhaar_last4 = coalesce(nullif(btrim(p_aadhaar_last4), ''), aadhaar_last4),
         reviewed_at = now(), reviewed_by = auth.uid(), review_notes = nullif(btrim(p_review_notes), ''), updated_at = now()
   where client_id = p_client_id
   returning * into result_row;
  if result_row.client_id is null then raise exception using errcode = '22023', message = 'KYC record not found'; end if;
  update public.client_kyc_documents set status = case when p_status = 'approved' then 'approved' else p_status end, reviewed_by = auth.uid(), review_note = p_review_notes, updated_at = now() where client_id = p_client_id and document_type in ('aadhaar', 'gst', 'pan');
  return result_row;
end;
$$;

revoke all on function public.review_client_kyc(uuid, text, text, text, text, text) from public;
revoke execute on function public.review_client_kyc(uuid, text, text, text, text, text) from anon;
grant execute on function public.review_client_kyc(uuid, text, text, text, text, text) to authenticated;

create or replace function public.touch_client_kyc_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists client_kyc_profiles_updated_at on public.client_kyc_profiles;
create trigger client_kyc_profiles_updated_at before update on public.client_kyc_profiles for each row execute function public.touch_client_kyc_updated_at();
drop trigger if exists client_kyc_documents_updated_at on public.client_kyc_documents;
create trigger client_kyc_documents_updated_at before update on public.client_kyc_documents for each row execute function public.touch_client_kyc_updated_at();

-- Keep the public profile update surface limited to identity fields already
-- approved by the existing profile-hardening migration.
