import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/realtime/RoomManager';
import { Participant } from '@/stores/participantStore';

/**
 * POST /api/rooms/[roomId]/participants
 * Join a room
 * Body: { participant: Participant }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { participant } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    if (!participant || !participant.peerId || !participant.name) {
      return NextResponse.json({ error: 'Invalid participant data' }, { status: 400 });
    }

    const success = roomManager.joinRoom(roomId, participant as Participant);

    if (!success) {
      const roomInfo = roomManager.getRoomInfo(roomId);
      if (!roomInfo) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }
      return NextResponse.json(
        {
          error: 'Room is full or not available',
          participantCount: roomInfo.participantCount,
          maxParticipants: roomInfo.config.maxParticipants,
        },
        { status: 409 }
      );
    }

    const roomInfo = roomManager.getRoomInfo(roomId);

    return NextResponse.json(
      {
        success: true,
        roomId,
        participantCount: roomInfo?.participantCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}

/**
 * DELETE /api/rooms/[roomId]/participants
 * Leave a room or kick a participant
 * Body: { peerId: string, kickedBy?: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { peerId, kickedBy } = body;

    if (!roomId || !peerId) {
      return NextResponse.json({ error: 'roomId and peerId are required' }, { status: 400 });
    }

    const roomInfo = roomManager.getRoomInfo(roomId);

    if (!roomInfo) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // If kickedBy is provided, verify that it's a tutor
    if (kickedBy) {
      const kicker = roomManager.getParticipant(roomId, kickedBy);
      if (!kicker || kicker.role !== 'tutor') {
        return NextResponse.json({ error: 'Only tutors can kick participants' }, { status: 403 });
      }
    }

    const success = roomManager.leaveRoom(roomId, peerId);

    if (!success) {
      return NextResponse.json({ error: 'Participant not found in room' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      roomId,
      peerId,
    });
  } catch (error) {
    console.error('Error leaving room:', error);
    return NextResponse.json({ error: 'Failed to leave room' }, { status: 500 });
  }
}
