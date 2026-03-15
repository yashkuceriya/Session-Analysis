import { NextRequest, NextResponse } from 'next/server';
import { saveMetricsBatch, saveNudges } from '@/lib/supabase/sessions';

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
