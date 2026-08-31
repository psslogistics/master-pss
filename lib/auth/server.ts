import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireSuperAdmin() {
  const supabase = await createClient(); const claimsResult = await supabase.auth.getClaims(); const userId = claimsResult.data?.claims?.sub;
  if (!userId) redirect('/login');
  const { data } = await supabase.from('profiles').select('id,email,display_name,status,user_roles(role:roles(role_code,scope))').eq('id', userId).maybeSingle();
  const roles = (data?.user_roles ?? []) as Array<{ role?: { role_code?: string; scope?: string } }>;
  if (!data || data.status !== 'active' || !roles.some((item) => item.role?.role_code === 'super_admin')) redirect('/login');
  return { userId, profile: data, roles };
}
