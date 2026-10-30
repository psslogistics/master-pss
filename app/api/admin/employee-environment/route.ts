import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const environments = new Set(["production", "test"]);

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  let body: { userId?: string; environment?: string; reason?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const userId = body.userId?.trim();
  const environment = body.environment?.trim();
  const reason = body.reason?.trim();
  if (!userId || !environment || !environments.has(environment) || !reason || reason.length < 8 || reason.length > 500) {
    return NextResponse.json({ error: "Choose production or test and provide a reason (8–500 characters)." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "Server provisioning is not configured." }, { status: 503 }); }

  const [{ data: employee, error: employeeError }, { data: roleRows, error: roleError }] = await Promise.all([
    admin.from("employee_profiles").select("user_id,identity_environment").eq("user_id", userId).maybeSingle(),
    admin.from("user_roles").select("roles(role_code),is_active").eq("user_id", userId).eq("is_active", true),
  ]);
  if (employeeError) return NextResponse.json({ error: "Employee environment classification is unavailable. Apply the employee classification migration, then retry." }, { status: 503 });
  if (roleError) return NextResponse.json({ error: "Employee role could not be verified." }, { status: 500 });
  if (!employee) return NextResponse.json({ error: "Employee was not found." }, { status: 404 });
  const isSuperAdmin = (roleRows ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.role_code === "super_admin";
  });
  if (isSuperAdmin) return NextResponse.json({ error: "Super Admin identities cannot be classified through the employee directory." }, { status: 403 });

  const previous = employee.identity_environment ?? "unclassified";
  if (previous === environment) return NextResponse.json({ ok: true, environment });
  const update = await admin.from("employee_profiles").update({ identity_environment: environment }).eq("user_id", userId);
  if (update.error) return NextResponse.json({ error: "Employee environment classification could not be saved." }, { status: 500 });

  const supabase = await createClient();
  const audit = await supabase.from("admin_audit_events").insert({
    actor_user_id: actor.userId,
    action: environment === "test" ? "Classified employee as test identity" : "Classified employee as production identity",
    entity_type: "Employee",
    entity_id: userId,
    before_state: { identity_environment: previous },
    after_state: { identity_environment: environment, reason },
  });
  if (audit.error) {
    await admin.from("employee_profiles").update({ identity_environment: previous }).eq("user_id", userId);
    return NextResponse.json({ error: "Classification was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, environment });
}
