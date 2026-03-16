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
      return NextResponse.json({ error: 'AI analysis requires ANTHROPIC_API_KEY environment variable. Set it in your .env.local file.' }, { status: 503 });
    }

    // Parse body first (client may send metrics as fallback)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let metrics, nudges, config;

    // Try Supabase first
    try {
      const [session, dbMetrics, dbNudges] = await Promise.all([
        getSession(sessionId),
        getSessionMetrics(sessionId),
        getSessionNudges(sessionId),
      ]);
      if (dbMetrics && dbMetrics.length > 0) {
        metrics = dbMetrics;
        nudges = dbNudges;
        config = session.config;
      }
    } catch {
      // Supabase unavailable
    }

    // Fall back to request body
    if (!metrics || metrics.length === 0) {
      metrics = body.metrics || [];
      nudges = body.nudges || [];
      config = body.config || { subject: 'Unknown', sessionType: 'discussion', studentLevel: 'Unknown', tutorName: 'Tutor', studentName: 'Student' };
    }

    if (!metrics || metrics.length === 0) {
      return NextResponse.json({ error: 'No session data available for analysis' }, { status: 400 });
    }

    const analysis = await analyzeSessionWithAI(metrics, nudges, config);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('AI analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Surface actionable messages to the client
    if (message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    if (message.includes('authentication') || message.includes('401') || message.includes('invalid x-api-key')) {
      return NextResponse.json({ error: 'Invalid ANTHROPIC_API_KEY. Check your .env.local file.' }, { status: 401 });
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return NextResponse.json({ error: 'AI rate limit reached. Please wait a moment and try again.' }, { status: 429 });
    }
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
