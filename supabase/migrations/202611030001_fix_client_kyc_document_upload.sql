-- The client uploads a new private object and then records/replaces its
-- metadata. A direct PostgREST upsert fails because the original migration
-- intentionally does not grant broad UPDATE access to KYC identity/status
-- columns. Keep that boundary and expose a narrowly checked RPC instead.
create or replace function public.replace_client_kyc_document(
  p_document_type text,
  p_object_path text,
  p_original_filename text,
  p_content_type text
)
returns public.client_kyc_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client uuid;
  result_row public.client_kyc_documents;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if p_document_type not in ('aadhaar', 'gst', 'pan') then
    raise exception using errcode = '22023', message = 'Unsupported KYC document type';
  end if;
  if p_content_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception using errcode = '22023', message = 'Unsupported KYC document type';
  end if;

  select cm.client_id into target_client
    from public.client_memberships cm
   where cm.user_id = auth.uid()
     and cm.membership_status = 'active'
   order by cm.is_primary desc nulls last, cm.assigned_at asc
   limit 1;
  if target_client is null then
    raise exception using errcode = '42501', message = 'An active client assignment is required';
  end if;
  if position(target_client::text || '/' || p_document_type || '/' in p_object_path) <> 1 then
    raise exception using errcode = '42501', message = 'Invalid KYC document path';
  end if;
  if nullif(btrim(p_original_filename), '') is null or length(p_original_filename) > 255 then
    raise exception using errcode = '22023', message = 'Invalid KYC document filename';
  end if;

  insert into public.client_kyc_documents (
    client_id, document_type, object_path, original_filename, content_type,
    status, uploaded_by
  ) values (
    target_client, p_document_type, p_object_path, p_original_filename,
    p_content_type, 'submitted', auth.uid()
  )
  on conflict (client_id, document_type) do update set
    object_path = excluded.object_path,
    original_filename = excluded.original_filename,
    content_type = excluded.content_type,
    status = 'submitted',
    uploaded_by = auth.uid(),
    reviewed_by = null,
    review_note = null,
    updated_at = now()
  returning * into result_row;
  return result_row;
end;
$$;

revoke all on function public.replace_client_kyc_document(text, text, text, text) from public;
revoke execute on function public.replace_client_kyc_document(text, text, text, text) from anon;
grant execute on function public.replace_client_kyc_document(text, text, text, text) to authenticated;

