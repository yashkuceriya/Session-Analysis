import { NextRequest, NextResponse } from 'next/server';
import { analyzeSessionWithAI } from '@/lib/ai/claude-analyzer';
import { getSessionMetrics, getSessionNudges, getSession } from '@/lib/supabase/sessions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI analysis not configured' }, { status: 503 });
    }

    // Try loading from Supabase first, fall back to request body
    let metrics, nudges, config;

    try {
      const [session, dbMetrics, dbNudges] = await Promise.all([
        getSession(sessionId),
        getSessionMetrics(sessionId),
        getSessionNudges(sessionId),
      ]);
      metrics = dbMetrics;
      nudges = dbNudges;
      config = session.config;
    } catch {
      // Fall back to request body
      const body = await req.json();
      metrics = body.metrics || [];
      nudges = body.nudges || [];
      config = body.config || { subject: 'Unknown', sessionType: 'discussion', studentLevel: 'Unknown', tutorName: 'Tutor', studentName: 'Student' };
    }

    if (!metrics || metrics.length === 0) {
      return NextResponse.json({ error: 'No session data available' }, { status: 400 });
    }

    const analysis = await analyzeSessionWithAI(metrics, nudges, config);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
