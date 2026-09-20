import { createClient } from "@/lib/supabase/client";

export async function pssApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await createClient().auth.getSession();
  if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
  const base = process.env.NEXT_PUBLIC_PSS_API_URL;
  if (!base) throw new Error("PSS API is not configured.");
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes((init.method ?? "GET").toUpperCase());
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { ...init, headers: { Authorization: `Bearer ${session.access_token}`, ...(init.body ? { "content-type": "application/json" } : {}), ...(mutating ? { "Idempotency-Key": crypto.randomUUID() } : {}), ...init.headers } });
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "The PSS API request failed.");
  return body;
}
