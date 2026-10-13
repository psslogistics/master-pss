import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  await requireSuperAdmin();
  const body = await request.json() as { clientId?: string; employeeId?: string };
  if (!body.clientId || !body.employeeId) return NextResponse.json({ error: "clientId and employeeId are required." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("transfer_employee_client_assignment", { target_client_id: body.clientId, target_employee_user_id: body.employeeId });
  if (error) return NextResponse.json({ error: error.message.includes("client_not_found") ? "Client account was not found." : error.message.includes("employee_not_active") ? "Choose an active employee." : "Unable to save the client assignment atomically." }, { status: error.message.includes("not_found") ? 404 : 400 });
  return NextResponse.json({ assignment: data });
}
