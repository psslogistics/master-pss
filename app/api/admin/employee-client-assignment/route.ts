import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { clientId?: string; employeeId?: string };
  if (!body.clientId || !body.employeeId) return NextResponse.json({ error: "clientId and employeeId are required." }, { status: 400 });
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || userData.user?.id !== actor.userId) {
    return NextResponse.json({ error: "Your admin session expired. Refresh the page and sign in again." }, { status: 401 });
  }
  const { data, error } = await supabase.rpc("transfer_employee_client_assignment", { target_client_id: body.clientId, target_employee_user_id: body.employeeId });
  if (error) {
    console.error("Client assignment transfer failed", { code: error.code, message: error.message, actorUserId: actor.userId, clientId: body.clientId, employeeId: body.employeeId });
    const message = error.message.toLowerCase();
    if (message.includes("client_not_found")) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
    if (message.includes("employee_not_active")) return NextResponse.json({ error: "Choose an active employee." }, { status: 400 });
    if (message.includes("super_admin_required") || error.code === "42501") return NextResponse.json({ error: "Your admin session is not authorized for this transfer. Refresh the page and sign in again." }, { status: 403 });
    if (error.code === "PGRST202") return NextResponse.json({ error: "The assignment service is not available in this deployment." }, { status: 503 });
    if (error.code === "23503") return NextResponse.json({ error: "The selected employee or client is no longer available. Refresh the page and try again." }, { status: 409 });
    return NextResponse.json({ error: "The assignment could not be saved. Refresh the page and try again." }, { status: 400 });
  }
  return NextResponse.json({ assignment: data });
}
