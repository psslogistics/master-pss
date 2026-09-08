import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { userId?: string; disabled?: boolean };
  if (!body.userId || typeof body.disabled !== "boolean") return NextResponse.json({ error: "userId and disabled are required" }, { status: 400 });
  const supabase = await createClient();
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: "Server provisioning is not configured" }, { status: 503 }); }
  const nextStatus = body.disabled ? "disabled" : "active";
  const [{ error: employeeError }, { error: profileError }, { error: auditError }] = await Promise.all([
    admin.from("employee_profiles").update({ employment_status: nextStatus }).eq("user_id", body.userId),
    admin.from("profiles").update({ status: body.disabled ? "suspended" : "active" }).eq("id", body.userId),
    supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: body.disabled ? "Disabled employee" : "Enabled employee", entity_type: "Employee", entity_id: body.userId, after_state: { employment_status: nextStatus } }),
  ]);
  if (employeeError || profileError || auditError) return NextResponse.json({ error: employeeError?.message ?? profileError?.message ?? auditError?.message ?? "Unable to update employee access" }, { status: 400 });
  return NextResponse.json({ ok: true, status: nextStatus });
}
