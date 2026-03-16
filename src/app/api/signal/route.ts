import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

interface SignalMessage {
  id: string;
  type: string;
  from: string;
  roomId: string;
  sdp?: any;
  candidate?: any;
  data?: any;
  timestamp: number;
}

// ─── Supabase configuration detection ───────────────────────────────
const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getDb() {
  if (!hasSupabase) return null;
  try {
    return getSupabaseAdmin();
  } catch (error) {
    console.error('[Signal API] Failed to initialize Supabase:', error);
    return null;
  }
}

// ─── In-memory fallback (dev mode / single-instance) ────────────────
const memoryStore = new Map<string, SignalMessage[]>();
const MESSAGE_RETENTION_TIME = 30000;
let lastCleanupTime = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanupTime < 10000) return;
  lastCleanupTime = now;
  const cutoff = now - MESSAGE_RETENTION_TIME;

  for (const roomId of Array.from(memoryStore.keys())) {
    const messages = memoryStore.get(roomId);
    if (messages) {
      const filtered = messages.filter((m) => m.timestamp > cutoff);
      if (filtered.length === 0) {
        memoryStore.delete(roomId);
      } else {
        memoryStore.set(roomId, filtered);
      }
    }
  }
}

// POST: Store a signaling message
export async function POST(req: NextRequest) {
  try {
    const msg = await req.json();
    const roomId = msg.roomId;

    if (!roomId || !msg.from || !msg.type) {
      return NextResponse.json(
        { error: 'Missing required fields: roomId, from, type' },
        { status: 400 }
      );
    }

    const signalMsg: SignalMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: msg.type,
      from: msg.from,
      roomId: msg.roomId,
      sdp: msg.sdp,
      candidate: msg.candidate,
      data: msg.data,
      timestamp: Date.now(),
    };

    // Try Supabase first
    const db = getDb();
    if (db) {
      try {
        const { error } = await db.from('signal_messages').insert({
          id: signalMsg.id,
          room_id: signalMsg.roomId,
          type: signalMsg.type,
          sender_role: signalMsg.from,
          payload: {
            sdp: signalMsg.sdp,
            candidate: signalMsg.candidate,
            data: signalMsg.data,
          },
        });

        if (!error) {
          // Async cleanup — fire and forget
          void db.from('signal_messages')
            .delete()
            .lt('created_at', new Date(Date.now() - 60000).toISOString());

          return NextResponse.json(
            { ok: true, id: signalMsg.id, serverTime: Date.now(), backend: 'supabase' },
            { status: 200 }
          );
        } else {
          console.error('[Signal API] Supabase insert error:', error.message, error.code);
          // Fall through to memory store
        }
      } catch (supabaseError) {
        console.error('[Signal API] Supabase exception:', supabaseError);
        // Fall through to memory store
      }
    }

    // In-memory fallback
    if (!memoryStore.has(roomId)) {
      memoryStore.set(roomId, []);
    }
    memoryStore.get(roomId)!.push(signalMsg);
    cleanupMemory();

    return NextResponse.json(
      { ok: true, id: signalMsg.id, serverTime: Date.now(), backend: 'memory' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Signal API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to store signal message' },
      { status: 500 }
    );
  }
}

// GET: Poll for messages
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const role = req.nextUrl.searchParams.get('role');
  const since = parseInt(req.nextUrl.searchParams.get('since') || '0', 10);

  if (!room || !role) {
    return NextResponse.json(
      { error: 'Missing required parameters: room, role' },
      { status: 400 }
    );
  }

  // Try Supabase first
  const db = getDb();
  if (db) {
    try {
      // Use >= with a small buffer to prevent missing messages at boundaries
      const sinceISO = new Date(Math.max(0, since)).toISOString();
      const { data, error } = await db
        .from('signal_messages')
        .select('*')
        .eq('room_id', room)
        .neq('sender_role', role)
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: true })
        .limit(50);

      if (!error && data) {
        const messages: SignalMessage[] = data.map((row: any) => ({
          id: row.id,
          type: row.type,
          from: row.sender_role,
          roomId: row.room_id,
          sdp: row.payload?.sdp,
          candidate: row.payload?.candidate,
          data: row.payload?.data,
          timestamp: new Date(row.created_at).getTime(),
        }));

        return NextResponse.json(
          { messages, serverTime: Date.now(), backend: 'supabase' },
          { status: 200 }
        );
      } else {
        console.error('[Signal API] Supabase query error:', error?.message, error?.code);
      }
    } catch (supabaseError) {
      console.error('[Signal API] Supabase exception:', supabaseError);
    }
  }

  // In-memory fallback
  cleanupMemory();
  const messages = (memoryStore.get(room) || [])
    .filter((m) => m.from !== role && m.timestamp > since)
    .sort((a, b) => a.timestamp - b.timestamp);

  return NextResponse.json(
    { messages, serverTime: Date.now(), backend: 'memory' },
    { status: 200 }
  );
}
