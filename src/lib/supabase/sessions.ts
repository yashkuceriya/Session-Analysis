/**
 * Session storage layer — uses Supabase when configured, falls back to file-based storage.
 * This ensures the dashboard and API routes work in dev/staging without a database.
 */

import { MetricSnapshot } from '../metrics-engine/types';
import { Nudge } from '../coaching-system/types';
import { SessionConfig } from '../session/types';

// ─── Detect backend ────────────────────────────────────────
const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── File-based storage (fallback) ─────────────────────────
const DATA_DIR = '.data/sessions';

function getFs() {
  // Dynamic require to avoid bundling in client
  const fn = new Function('m', 'return require(m)');
  return {
    fs: fn('fs') as typeof import('fs'),
    path: fn('path') as typeof import('path'),
  };
}

function ensureDir() {
  const { fs, path } = getFs();
  const dir = path.resolve(process.cwd(), DATA_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function sessionPath(id: string): string {
  const { path } = getFs();
  return path.join(ensureDir(), `${id}.json`);
}

interface StoredSessionFile {
  id: string;
  config: SessionConfig;
  startTime: number;
  endTime: number | null;
  status: 'active' | 'completed';
  metrics: MetricSnapshot[];
  nudges: Nudge[];
}

function readSessionFile(id: string): StoredSessionFile | null {
  const { fs } = getFs();
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeSessionFile(data: StoredSessionFile) {
  const { fs } = getFs();
  fs.writeFileSync(sessionPath(data.id), JSON.stringify(data), 'utf-8');
}

function listSessionFiles(): StoredSessionFile[] {
  const { fs } = getFs();
  const dir = ensureDir();
  return fs.readdirSync(dir)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => {
      try {
        const { path } = getFs();
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as StoredSessionFile;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as StoredSessionFile[];
}

// ─── Supabase backend ──────────────────────────────────────
function getDb() {
  // Only called when hasSupabase is true
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSupabaseAdmin } = require('./server') as { getSupabaseAdmin: () => import('@supabase/supabase-js').SupabaseClient };
  return getSupabaseAdmin();
}

// ─── Public API ────────────────────────────────────────────

export async function createSession(id: string, config: SessionConfig, startTime: number) {
  if (hasSupabase) {
    const { error } = await getDb().from('sessions').insert({
      id,
      config,
      start_time: new Date(startTime).toISOString(),
      status: 'active',
    });
    if (error) throw error;
    return;
  }

  // File fallback
  writeSessionFile({ id, config, startTime, endTime: null, status: 'active', metrics: [], nudges: [] });
}

export async function endSession(id: string) {
  if (hasSupabase) {
    const { error } = await getDb()
      .from('sessions')
      .update({ end_time: new Date().toISOString(), status: 'completed' })
      .eq('id', id);
    if (error) throw error;
    return;
  }

  // File fallback
  const session = readSessionFile(id);
  if (session) {
    session.endTime = Date.now();
    session.status = 'completed';
    writeSessionFile(session);
  }
}

export async function saveMetricsBatch(sessionId: string, snapshots: MetricSnapshot[]) {
  if (snapshots.length === 0) return;

  if (hasSupabase) {
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
    const { error } = await getDb().from('metric_snapshots').insert(rows);
    if (error) throw error;
    return;
  }

  // File fallback — append metrics
  const session = readSessionFile(sessionId);
  if (session) {
    session.metrics = [...session.metrics, ...snapshots];
    writeSessionFile(session);
  }
}

export async function saveNudges(sessionId: string, nudges: Nudge[]) {
  if (nudges.length === 0) return;

  if (hasSupabase) {
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
    const { error } = await getDb().from('nudge_history').upsert(rows);
    if (error) throw error;
    return;
  }

  // File fallback — replace nudges
  const session = readSessionFile(sessionId);
  if (session) {
    session.nudges = nudges;
    writeSessionFile(session);
  }
}

export async function getSession(id: string) {
  if (hasSupabase) {
    const { data, error } = await getDb()
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  // File fallback
  const session = readSessionFile(id);
  if (!session) throw new Error('Session not found');
  return {
    id: session.id,
    config: session.config,
    start_time: new Date(session.startTime).toISOString(),
    end_time: session.endTime ? new Date(session.endTime).toISOString() : null,
    status: session.status,
  };
}

export async function getSessionMetrics(sessionId: string): Promise<MetricSnapshot[]> {
  if (hasSupabase) {
    const { data, error } = await getDb()
      .from('metric_snapshots')
      .select('raw_snapshot')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return (data || []).map((r: { raw_snapshot: MetricSnapshot }) => r.raw_snapshot);
  }

  // File fallback
  const session = readSessionFile(sessionId);
  return session?.metrics || [];
}

export async function getSessionNudges(sessionId: string) {
  if (hasSupabase) {
    const { data, error } = await getDb()
      .from('nudge_history')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // File fallback
  const session = readSessionFile(sessionId);
  return session?.nudges || [];
}

export async function listSessions(tutorId?: string) {
  if (hasSupabase) {
    let query = getDb()
      .from('sessions')
      .select('id, config, start_time, end_time, status, tutor_id')
      .order('start_time', { ascending: false })
      .limit(50);

    if (tutorId) {
      query = query.eq('tutor_id', tutorId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const sessions = data || [];

    // Fetch average engagement for each session from metric_snapshots
    const sessionIds = sessions.map(s => s.id);
    let engagementMap: Record<string, number> = {};

    if (sessionIds.length > 0) {
      const { data: metricsData } = await getDb()
        .from('metric_snapshots')
        .select('session_id, engagement_score')
        .in('session_id', sessionIds);

      if (metricsData && metricsData.length > 0) {
        const grouped: Record<string, number[]> = {};
        for (const m of metricsData) {
          if (!grouped[m.session_id]) grouped[m.session_id] = [];
          grouped[m.session_id].push(m.engagement_score);
        }
        for (const [sid, scores] of Object.entries(grouped)) {
          engagementMap[sid] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
      }
    }

    return sessions.map(s => {
      const startMs = new Date(s.start_time).getTime();
      const endMs = s.end_time ? new Date(s.end_time).getTime() : null;
      return {
        ...s,
        startTime: startMs,
        duration: endMs ? endMs - startMs : 0,
        engagementScore: engagementMap[s.id] || 0,
      };
    });
  }

  // File fallback
  const sessions = listSessionFiles()
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, 50)
    .map((s) => ({
      id: s.id,
      config: s.config,
      start_time: new Date(s.startTime).toISOString(),
      end_time: s.endTime ? new Date(s.endTime).toISOString() : null,
      status: s.status,
      startTime: s.startTime,
      duration: s.endTime ? s.endTime - s.startTime : 0,
      engagementScore: s.metrics.length > 0
        ? s.metrics.reduce((sum, m) => sum + m.engagementScore, 0) / s.metrics.length
        : 0,
    }));

  return sessions;
}
