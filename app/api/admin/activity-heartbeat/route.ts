import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Employee activity tracking is not configured." }, { status: 503 });
  }

  const { data: employee, error: lookupError } = await admin
    .from("employee_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Employee activity could not be verified." }, { status: 500 });
  if (!employee) return NextResponse.json({ error: "No employee activity record exists for this account." }, { status: 404 });

  // Enforce the heartbeat interval on the server as well as the browser. This
  // keeps duplicate tabs or direct repeated requests from producing needless
  // profile writes while still updating employees whose activity is unknown.
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { error: updateError } = await admin
    .from("employee_profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .or(`last_active_at.is.null,last_active_at.lt.${staleBefore}`);
  if (updateError) return NextResponse.json({ error: "Employee activity could not be updated." }, { status: 500 });

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
