import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  try {
    const candidate = new URL(value, 'https://pss-logistics.invalid');
    return candidate.origin === 'https://pss-logistics.invalid' ? `${candidate.pathname}${candidate.search}${candidate.hash}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get('code'); const next = safeNextPath(url.searchParams.get('next'));
  const response = NextResponse.redirect(new URL(next, url.origin));
  if (code) { const supabase = await createClient(); const { error } = await supabase.auth.exchangeCodeForSession(code); if (!error && next === '/reset-password') response.cookies.set('pss_password_recovery', '1', { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', maxAge: 600, path: '/reset-password' }); }
  return response;
}
