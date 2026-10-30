import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await requireSuperAdmin();
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1), 200);
  const offset = Math.max(Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("admin_audit_events")
    .select("id,actor_user_id,action,entity_type,entity_id,before_state,after_state,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (error) return NextResponse.json({ error: "Super Admin audit events could not be loaded." }, { status: 500 });
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  return NextResponse.json({ data: page, pagination: { limit, offset, total: count ?? 0, next_offset: offset + page.length, has_more: rows.length > limit } }, { headers: { "Cache-Control": "no-store" } });
}
