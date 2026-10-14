import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { clientId?: string; employeeId?: string };
  if (!body.clientId || !body.employeeId) return NextResponse.json({ error: "clientId and employeeId are required." }, { status: 400 });
  const supabase = await createClient();
  // Hydrate the SSR client's session before the RPC so PostgREST receives the
  // same access token that passed the Super Admin gate above.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || sessionData.session?.user.id !== actor.userId) {
    return NextResponse.json({ error: "Your admin session expired. Refresh the page and sign in again." }, { status: 401 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey || !sessionData.session?.access_token) {
    return NextResponse.json({ error: "The admin session could not be forwarded to the assignment service." }, { status: 503 });
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/transfer_employee_client_assignment`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${sessionData.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_client_id: body.clientId, target_employee_user_id: body.employeeId }),
    cache: "no-store",
  });
  const rpcPayload = await rpcResponse.json().catch(() => null) as { code?: string; message?: string; assignment?: unknown } | null;
  if (!rpcResponse.ok) {
    const code = rpcPayload?.code ?? "";
    const rpcMessage = rpcPayload?.message ?? "Assignment RPC failed";
    console.error("Client assignment transfer failed", { code, message: rpcMessage, actorUserId: actor.userId, clientId: body.clientId, employeeId: body.employeeId });
    const message = rpcMessage.toLowerCase();
    if (message.includes("client_not_found")) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
    if (message.includes("employee_not_active")) return NextResponse.json({ error: "Choose an active employee." }, { status: 400 });
    if (message.includes("super_admin_required") || code === "42501" || rpcResponse.status === 401 || rpcResponse.status === 403) return NextResponse.json({ error: "Your admin session is not authorized for this transfer. Refresh the page and sign in again." }, { status: 403 });
    if (code === "PGRST202") return NextResponse.json({ error: "The assignment service is not available in this deployment." }, { status: 503 });
    if (code === "23503") return NextResponse.json({ error: "The selected employee or client is no longer available. Refresh the page and try again." }, { status: 409 });
    return NextResponse.json({ error: "The assignment could not be saved. Refresh the page and try again." }, { status: 400 });
  }
  return NextResponse.json({ assignment: rpcPayload?.assignment ?? rpcPayload });
}
