import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowed = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function GET() {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("rate_cards").select("id,client_id,object_path,original_filename,mime_type,byte_size,updated_at,client_accounts(legal_name,client_code)").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load rate cards." }, { status: 500 });
  return NextResponse.json({ rateCards: data ?? [] });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const form = await request.formData(); const clientId = String(form.get("clientId") ?? ""); const file = form.get("file");
  if (!clientId || !(file instanceof File)) return NextResponse.json({ error: "A client and rate-card file are required." }, { status: 400 });
  if (!allowed.has(file.type) || file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Upload a PDF or XLSX file up to 10 MB." }, { status: 400 });
  const admin = createAdminClient();
  const { data: client } = await admin.from("client_accounts").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
  const { data: previous } = await admin.from("rate_cards").select("id,object_path").eq("client_id", clientId).maybeSingle();
  const extension = file.type === "application/pdf" ? "pdf" : "xlsx";
  const objectPath = `${clientId}/${crypto.randomUUID()}.${extension}`;
  const upload = await admin.storage.from("rate-cards").upload(objectPath, file, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "Unable to upload rate card." }, { status: 500 });
  const { data: saved, error } = await admin.from("rate_cards").upsert({ client_id: clientId, object_path: objectPath, original_filename: file.name, mime_type: file.type, byte_size: file.size, uploaded_by: actor.userId, updated_at: new Date().toISOString() }, { onConflict: "client_id" }).select("id,client_id,original_filename,mime_type,byte_size,updated_at").single();
  if (error) { await admin.storage.from("rate-cards").remove([objectPath]); return NextResponse.json({ error: "Unable to save rate-card metadata." }, { status: 500 }); }
  if (previous?.object_path) await admin.storage.from("rate-cards").remove([previous.object_path]);
  await admin.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: previous ? "Replaced rate card" : "Uploaded rate card", entity_type: "Client", entity_id: clientId, before_state: previous ? { objectPath: previous.object_path } : null, after_state: { objectPath, filename: file.name } });
  return NextResponse.json({ rateCard: saved }, { status: previous ? 200 : 201 });
}

export async function PATCH(request: Request) {
  await requireSuperAdmin();
  const { clientId } = await request.json() as { clientId?: string };
  if (!clientId) return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  const admin = createAdminClient(); const { data } = await admin.from("rate_cards").select("object_path").eq("client_id", clientId).maybeSingle();
  if (!data) return NextResponse.json({ error: "Rate card was not found." }, { status: 404 });
  const signed = await admin.storage.from("rate-cards").createSignedUrl(data.object_path, 60);
  if (signed.error) return NextResponse.json({ error: "Unable to prepare download." }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl });
}
