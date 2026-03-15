import { getSupabaseAdmin } from './server';

const db = () => getSupabaseAdmin();
import { MetricSnapshot } from '../metrics-engine/types';
import { Nudge } from '../coaching-system/types';
import { SessionConfig } from '../session/types';

export async function createSession(id: string, config: SessionConfig, startTime: number) {
  const { error } = await db().from('sessions').insert({
    id,
    config,
    start_time: new Date(startTime).toISOString(),
    status: 'active',
  });
  if (error) throw error;
}

export async function endSession(id: string) {
  const { error } = await db()
    .from('sessions')
    .update({ end_time: new Date().toISOString(), status: 'completed' })
    .eq('id', id);
  if (error) throw error;
}

export async function saveMetricsBatch(sessionId: string, snapshots: MetricSnapshot[]) {
  if (snapshots.length === 0) return;

  const rows = snapshots.map((s) => ({
    session_id: sessionId,
    timestamp: new Date(s.timestamp).toISOString(),
    engagement_score: s.engagementScore,
    student_state: s.studentState,
    tutor_eye_contact: s.tutor.eyeContactScore,
    student_eye_contact: s.student.eyeContactScore,
    tutor_talk_percent: s.tutor.talkTimePercent,
    student_talk_percent: s.student.talkTimePercent,
    tutor_energy: s.tutor.energyScore,
    student_energy: s.student.energyScore,
    interruption_count: s.session.interruptionCount,
    raw_snapshot: s,
  }));

  const { error } = await db().from('metric_snapshots').insert(rows);
  if (error) throw error;
}

export async function saveNudges(sessionId: string, nudges: Nudge[]) {
  if (nudges.length === 0) return;

  const rows = nudges.map((n) => ({
    id: n.id,
    session_id: sessionId,
    rule_id: n.ruleId,
    message: n.message,
    icon: n.icon,
    priority: n.priority,
    timestamp: new Date(n.timestamp).toISOString(),
    trigger_metrics: n.triggerMetrics,
  }));

  const { error } = await db().from('nudge_history').upsert(rows);
  if (error) throw error;
}

export async function getSession(id: string) {
  const { data, error } = await db()
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getSessionMetrics(sessionId: string) {
  const { data, error } = await db()
    .from('metric_snapshots')
    .select('raw_snapshot')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => r.raw_snapshot as MetricSnapshot);
}

export async function getSessionNudges(sessionId: string) {
  const { data, error } = await db()
    .from('nudge_history')
    .select('*')
    .eq('session_id', sessionId)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listSessions(tutorId?: string) {
  let query = db()
    .from('sessions')
    .select('id, config, start_time, end_time, status')
    .order('start_time', { ascending: false })
    .limit(50);

  if (tutorId) {
    query = query.eq('tutor_id', tutorId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
