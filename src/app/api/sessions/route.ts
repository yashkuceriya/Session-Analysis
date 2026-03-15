import { NextRequest, NextResponse } from 'next/server';
import { createSession, listSessions } from '@/lib/supabase/sessions';

export async function POST(request: NextRequest) {
  try {
    const { id, config, startTime } = await request.json();
    if (!id || !config || !startTime) {
      return NextResponse.json({ error: 'Missing id, config, or startTime' }, { status: 400 });
    }
    await createSession(id, config, startTime);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('POST /api/sessions error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions, count: sessions.length });
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
