import { jwtVerify, SignJWT } from 'jose';

interface RoomTokenPayload {
  roomId: string;
  userId: string;
  role: 'tutor' | 'student' | 'admin';
  iat?: number;
  exp?: number;
}

const secretKey = process.env.ROOM_TOKEN_SECRET;
if (!secretKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ROOM_TOKEN_SECRET must be set in production');
  }
  // Dev-only fallback
}
const secret = new TextEncoder().encode(
  secretKey || 'dev-secret-only-do-not-use-in-production'
);

/**
 * Generate a JWT token for room access
 * Valid for 4 hours
 */
export async function generateRoomToken(
  roomId: string,
  userId: string,
  role: string
): Promise<string> {
  const token = await new SignJWT({
    roomId,
    userId,
    role: role as 'tutor' | 'student' | 'admin',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(secret);

  return token;
}

/**
 * Verify and decode a room token
 * Returns decoded payload or null if invalid/expired
 */
export async function verifyRoomToken(
  token: string
): Promise<RoomTokenPayload | null> {
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload as unknown as RoomTokenPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Get expiration time for a new room token (4 hours from now)
 */
export function getRoomTokenExpiration(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 4);
  return expiresAt;
}
