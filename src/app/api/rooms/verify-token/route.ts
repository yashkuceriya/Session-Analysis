import { NextRequest, NextResponse } from 'next/server';
import { verifyRoomToken } from '@/lib/auth/tokens';

export async function POST(request: NextRequest) {
  try {
    const { token, roomId } = await request.json();

    if (!token || !roomId) {
      return NextResponse.json(
        { error: 'Token and roomId required' },
        { status: 400 }
      );
    }

    const payload = await verifyRoomToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    if (payload.roomId !== roomId) {
      return NextResponse.json(
        { error: 'Token does not match room' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      userId: payload.userId,
      role: payload.role,
    });
  } catch {
    return NextResponse.json(
      { error: 'Token verification failed' },
      { status: 500 }
    );
  }
}
