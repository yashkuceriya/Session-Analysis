import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    env: {
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      AUTH_SECRET: !!process.env.AUTH_SECRET,
    },
  };

  // Test Supabase connection if configured
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/server');
      const db = getSupabaseAdmin();

      // Test signal_messages table exists
      const { data, error } = await db
        .from('signal_messages')
        .select('id')
        .limit(1);

      if (error) {
        checks.supabase = { connected: false, error: error.message, code: error.code };
      } else {
        checks.supabase = { connected: true, signalTable: true };
      }

      // Test sessions table
      const { error: sessError } = await db
        .from('sessions')
        .select('id')
        .limit(1);

      checks.supabase.sessionsTable = !sessError;
      if (sessError) {
        checks.supabase.sessionsError = sessError.message;
      }
    } catch (err) {
      checks.supabase = { connected: false, error: String(err) };
    }
  } else {
    checks.supabase = { connected: false, reason: 'env vars not set' };
  }

  return NextResponse.json(checks);
}
