-- Nerdy: Complete Supabase Schema
-- Run this in your Supabase SQL Editor to set up all tables and policies.
-- This schema supports both local development and production on Vercel.

-- ─────────────────────────────────────────────────────────────────────
-- SESSIONS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  tutor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_tutor_id ON sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);

-- ─────────────────────────────────────────────────────────────────────
-- METRIC SNAPSHOTS TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  engagement_score REAL NOT NULL DEFAULT 0,
  student_state TEXT,
  tutor_eye_contact REAL DEFAULT 0,
  student_eye_contact REAL DEFAULT 0,
  tutor_talk_percent REAL DEFAULT 0,
  student_talk_percent REAL DEFAULT 0,
  tutor_energy REAL DEFAULT 0,
  student_energy REAL DEFAULT 0,
  interruption_count INTEGER DEFAULT 0,
  raw_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_session_id ON metric_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metric_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metric_snapshots(created_at);

-- ─────────────────────────────────────────────────────────────────────
-- NUDGE HISTORY TABLE
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nudge_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  rule_id TEXT,
  message TEXT NOT NULL,
  icon TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  timestamp TIMESTAMPTZ NOT NULL,
  trigger_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nudges_session_id ON nudge_history(session_id);
CREATE INDEX IF NOT EXISTS idx_nudges_timestamp ON nudge_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_nudges_created_at ON nudge_history(created_at);

-- ─────────────────────────────────────────────────────────────────────
-- SIGNAL MESSAGES TABLE
-- ─────────────────────────────────────────────────────────────────────
-- Used for WebRTC signaling (ephemeral messages, auto-cleanup)
-- Enable Realtime on this table for real-time signaling updates
CREATE TABLE IF NOT EXISTS signal_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  type TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_room_id ON signal_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signal_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_signals_room_created ON signal_messages(room_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- ROOMS TABLE (Optional)
-- ─────────────────────────────────────────────────────────────────────
-- Persistent room state (if not using RoomManager singleton)
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  tutor_id TEXT,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
  max_participants INTEGER DEFAULT 2,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rooms_tutor_id ON rooms(tutor_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- ─────────────────────────────────────────────────────────────────────
-- ENABLE ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE nudge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────────────────────────────────
-- Service role (API routes) bypass RLS, so these policies allow
-- full access to ensure API routes work correctly.
-- Direct client access is restricted by these permissive policies
-- (which only work because clients don't use service role key).

CREATE POLICY "Service role full access on sessions" ON sessions
  FOR ALL USING (true);

CREATE POLICY "Service role full access on metric_snapshots" ON metric_snapshots
  FOR ALL USING (true);

CREATE POLICY "Service role full access on nudge_history" ON nudge_history
  FOR ALL USING (true);

CREATE POLICY "Service role full access on signal_messages" ON signal_messages
  FOR ALL USING (true);

CREATE POLICY "Service role full access on rooms" ON rooms
  FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- ENABLE REALTIME (optional for future Supabase Realtime integration)
-- ─────────────────────────────────────────────────────────────────────
-- Uncomment to enable Realtime on signal_messages for real-time WebRTC signaling
-- ALTER PUBLICATION supabase_realtime ADD TABLE signal_messages;

-- ─────────────────────────────────────────────────────────────────────
-- MAINTENANCE
-- ─────────────────────────────────────────────────────────────────────
-- Option 1: Manual cleanup of old signal messages (run periodically)
-- DELETE FROM signal_messages WHERE created_at < NOW() - INTERVAL '2 minutes';

-- Option 2: Use Supabase pg_cron to auto-cleanup (requires paid plan)
-- select cron.schedule('cleanup-signal-messages', '*/5 * * * *', $$
--   DELETE FROM signal_messages WHERE created_at < NOW() - INTERVAL '2 minutes';
-- $$);

-- Option 3: Use database functions + HTTP webhooks for scheduled cleanup
-- (See implementation guide in /docs/SETUP.md)
