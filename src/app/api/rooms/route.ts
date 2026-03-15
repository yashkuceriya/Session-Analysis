import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/realtime/RoomManager';

/**
 * POST /api/rooms
 * Create a new room
 * Body: { tutorId: string, config?: RoomConfig }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tutorId, config } = body;

    if (!tutorId || typeof tutorId !== 'string') {
      return NextResponse.json({ error: 'tutorId is required' }, { status: 400 });
    }

    const roomInfo = roomManager.createRoom(tutorId, config);

    return NextResponse.json(
      {
        roomId: roomInfo.roomId,
        inviteCode: roomInfo.inviteCode,
        createdAt: roomInfo.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

/**
 * GET /api/rooms
 * List rooms for current user (tutor)
 * Query: ?tutorId=<id>
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tutorId = searchParams.get('tutorId');

    if (!tutorId) {
      return NextResponse.json({ error: 'tutorId query param is required' }, { status: 400 });
    }

    const rooms = roomManager.getTutorRooms(tutorId);

    return NextResponse.json({
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        inviteCode: room.inviteCode,
        state: room.state,
        participantCount: room.participantCount,
        maxParticipants: room.config.maxParticipants,
        createdAt: room.createdAt,
      })),
      total: rooms.length,
    });
  } catch (error) {
    console.error('Error listing rooms:', error);
    return NextResponse.json({ error: 'Failed to list rooms' }, { status: 500 });
  }
}
