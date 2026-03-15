/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { generateRoomToken, getRoomTokenExpiration } from '@/lib/auth/tokens';
import { rateLimit } from '@/lib/auth/rate-limit';

interface TokenRequest {
  roomId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limiting: 30 token requests per user per minute
    const rateLimitResult = rateLimit(`token:${session.user.id}`, 30, 60 * 1000);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many token requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body: TokenRequest = await request.json();

    // Validate room ID
    if (!body.roomId?.trim()) {
      return NextResponse.json(
        { error: 'Invalid room ID' },
        { status: 400 }
      );
    }

    // Generate room token
    const userRole = typeof session?.user === 'object' && session.user !== null && 'role' in session.user
      ? (session.user as { role?: string }).role
      : undefined;
    const role = (userRole === 'tutor' || userRole === 'student') ? userRole : 'student';

    const token = await generateRoomToken(
      body.roomId,
      session.user.id,
      role
    );

    const expiresAt = getRoomTokenExpiration();

    return NextResponse.json(
      {
        token,
        expiresAt: expiresAt.toISOString(),
        expiresIn: 4 * 60 * 60, // 4 hours in seconds
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
