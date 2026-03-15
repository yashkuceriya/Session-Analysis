import { NextRequest, NextResponse } from 'next/server';
import { roomManager } from '@/lib/realtime/RoomManager';

/**
 * GET /api/rooms/[roomId]
 * Get room information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const roomInfo = roomManager.getRoomInfo(roomId);

    if (!roomInfo) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({
      roomId: roomInfo.roomId,
      inviteCode: roomInfo.inviteCode,
      tutorId: roomInfo.tutorId,
      state: roomInfo.state,
      createdAt: roomInfo.createdAt,
      participantCount: roomInfo.participantCount,
      maxParticipants: roomInfo.config.maxParticipants,
      participants: roomInfo.participants.map((p) => ({
        peerId: p.peerId,
        name: p.name,
        role: p.role,
        joinedAt: p.joinedAt,
        isMuted: p.isMuted,
        isCameraOff: p.isCameraOff,
      })),
      config: {
        recordingEnabled: roomInfo.config.recordingEnabled,
        screenShareEnabled: roomInfo.config.screenShareEnabled,
        chatEnabled: roomInfo.config.chatEnabled,
        subject: roomInfo.config.subject,
        sessionType: roomInfo.config.sessionType,
      },
    });
  } catch (error) {
    console.error('Error getting room info:', error);
    return NextResponse.json({ error: 'Failed to get room info' }, { status: 500 });
  }
}

/**
 * DELETE /api/rooms/[roomId]
 * End a room (tutor only)
 * Body: { tutorId: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { tutorId } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const roomInfo = roomManager.getRoomInfo(roomId);

    if (!roomInfo) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify tutor ownership
    if (roomInfo.tutorId !== tutorId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    roomManager.endRoom(roomId);

    return NextResponse.json({
      success: true,
      roomId,
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
  }
}
