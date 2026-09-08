import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { clientId?: string; employeeId?: string };
  if (!body.clientId || !body.employeeId) return NextResponse.json({ error: "clientId and employeeId are required." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: client, error: clientError }, { data: employee, error: employeeError }] = await Promise.all([
    admin.from("client_accounts").select("id,legal_name").eq("id", body.clientId).maybeSingle(),
    admin.from("employee_profiles").select("user_id,employment_status").eq("user_id", body.employeeId).maybeSingle(),
  ]);
  if (clientError || !client) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
  if (employeeError || !employee || employee.employment_status !== "active") return NextResponse.json({ error: "Choose an active employee." }, { status: 400 });
  const { data: profile } = await admin.from("profiles").select("status").eq("id", body.employeeId).maybeSingle();
  if (profile?.status !== "active") return NextResponse.json({ error: "Choose an active employee." }, { status: 400 });
  const { data: previous, error: previousError } = await admin.from("employee_client_assignments").select("employee_user_id").eq("client_id", body.clientId);
  if (previousError) return NextResponse.json({ error: "Unable to read current assignment." }, { status: 500 });
  const { error: insertError } = await admin.from("employee_client_assignments").upsert({ client_id: body.clientId, employee_user_id: body.employeeId, assigned_by: actor.userId, assigned_at: new Date().toISOString() }, { onConflict: "employee_user_id,client_id" });
  if (insertError) return NextResponse.json({ error: "Unable to save client assignment." }, { status: 500 });
  const { error: removeError } = await admin.from("employee_client_assignments").delete().eq("client_id", body.clientId).neq("employee_user_id", body.employeeId);
  if (removeError) return NextResponse.json({ error: "The new responsibility was saved, but prior assignments need attention." }, { status: 500 });
  await admin.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: "Transferred client", entity_type: "Client", entity_id: body.clientId, before_state: { employeeIds: (previous ?? []).map((item) => item.employee_user_id) }, after_state: { employeeId: body.employeeId } });
  return NextResponse.json({ assignment: { clientId: body.clientId, employeeId: body.employeeId } });
}
