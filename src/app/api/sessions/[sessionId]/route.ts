import { NextRequest, NextResponse } from 'next/server';
import { getSession, getSessionMetrics, getSessionNudges, endSession } from '@/lib/supabase/sessions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const [session, metrics, nudges] = await Promise.all([
      getSession(sessionId),
      getSessionMetrics(sessionId),
      getSessionNudges(sessionId),
    ]);
    return NextResponse.json({ session, metrics, nudges });
  } catch {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
}

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await endSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to end session' }, { status: 500 });
  }
}
