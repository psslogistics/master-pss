import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const environments = new Set(["production", "test"]);

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  let body: { clientId?: string; environment?: string; reason?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const clientId = body.clientId?.trim();
  const environment = body.environment?.trim();
  const reason = body.reason?.trim();
  if (!clientId || !environment || !environments.has(environment) || !reason || reason.length < 8 || reason.length > 500) {
    return NextResponse.json({ error: "Choose production or test and provide a reason (8–500 characters)." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "Server provisioning is not configured." }, { status: 503 }); }

  const { data: client, error: clientError } = await admin.from("client_accounts").select("id,identity_environment").eq("id", clientId).maybeSingle();
  if (clientError) return NextResponse.json({ error: "Client environment classification is unavailable. Apply the client identity migration, then retry." }, { status: 503 });
  if (!client) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });

  const previous = client.identity_environment ?? "unclassified";
  if (previous === environment) return NextResponse.json({ ok: true, environment });
  const update = await admin.from("client_accounts").update({ identity_environment: environment }).eq("id", clientId);
  if (update.error) return NextResponse.json({ error: "Client environment classification could not be saved." }, { status: 500 });

  const supabase = await createClient();
  const audit = await supabase.from("admin_audit_events").insert({
    actor_user_id: actor.userId,
    action: environment === "test" ? "Classified client organization as test identity" : "Classified client organization as production identity",
    entity_type: "Client",
    entity_id: clientId,
    before_state: { identity_environment: previous },
    after_state: { identity_environment: environment, reason },
  });
  if (audit.error) {
    await admin.from("client_accounts").update({ identity_environment: previous }).eq("id", clientId);
    return NextResponse.json({ error: "Classification was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, environment });
}
