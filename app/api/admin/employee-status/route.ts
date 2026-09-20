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
  const [{ data: employee }, { data: profile }, { data: roleRows }] = await Promise.all([
    admin.from("employee_profiles").select("user_id,employment_status").eq("user_id", body.userId).maybeSingle(),
    admin.from("profiles").select("status").eq("id", body.userId).maybeSingle(),
    supabase.from("user_roles").select("roles(role_code),is_active").eq("user_id", body.userId).eq("is_active", true),
  ]);
  if (!employee || !profile) return NextResponse.json({ error: "Employee was not found." }, { status: 404 });
  const isSuperAdmin = (roleRows ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.role_code === "super_admin";
  });
  if (isSuperAdmin) return NextResponse.json({ error: "Super Admin access cannot be disabled here." }, { status: 403 });
  const nextStatus = body.disabled ? "disabled" : "active";
  const employeeWrite = await admin.from("employee_profiles").update({ employment_status: nextStatus }).eq("user_id", body.userId);
  if (employeeWrite.error) return NextResponse.json({ error: employeeWrite.error.message }, { status: 400 });
  const profileWrite = await admin.from("profiles").update({ status: body.disabled ? "suspended" : "active" }).eq("id", body.userId);
  if (profileWrite.error) {
    await admin.from("employee_profiles").update({ employment_status: employee.employment_status }).eq("user_id", body.userId);
    return NextResponse.json({ error: profileWrite.error.message }, { status: 400 });
  }
  const auditWrite = await supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: body.disabled ? "Disabled employee" : "Enabled employee", entity_type: "Employee", entity_id: body.userId, before_state: { employment_status: employee.employment_status, profile_status: profile.status }, after_state: { employment_status: nextStatus, profile_status: body.disabled ? "suspended" : "active" } });
  if (auditWrite.error) {
    await Promise.all([
      admin.from("employee_profiles").update({ employment_status: employee.employment_status }).eq("user_id", body.userId),
      admin.from("profiles").update({ status: profile.status }).eq("id", body.userId),
    ]);
    return NextResponse.json({ error: "Employee access was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: nextStatus });
}
