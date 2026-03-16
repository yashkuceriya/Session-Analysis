import { NextRequest, NextResponse } from 'next/server';
import { saveMetricsBatch, saveNudges, getSessionMetrics, getSessionNudges } from '@/lib/supabase/sessions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const [metrics, nudges] = await Promise.all([
      getSessionMetrics(sessionId),
      getSessionNudges(sessionId),
    ]);
    return NextResponse.json({ metrics, nudges });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { snapshots, nudges } = await req.json();

    await Promise.all([
      saveMetricsBatch(sessionId, snapshots || []),
      saveNudges(sessionId, nudges || []),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save metrics' }, { status: 500 });
  }
}
