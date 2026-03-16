import { NextRequest, NextResponse } from 'next/server';
import { saveMetricsBatch, saveNudges, saveTranscript, getSessionMetrics, getSessionNudges, getSessionTranscript } from '@/lib/supabase/sessions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const [metrics, nudges, transcript] = await Promise.all([
      getSessionMetrics(sessionId),
      getSessionNudges(sessionId),
      getSessionTranscript(sessionId),
    ]);
    return NextResponse.json({ metrics, nudges, transcript });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    const { snapshots, nudges, transcript } = await req.json();

    await Promise.all([
      saveMetricsBatch(sessionId, snapshots || []),
      saveNudges(sessionId, nudges || []),
      saveTranscript(sessionId, transcript || []),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save metrics' }, { status: 500 });
  }
}
