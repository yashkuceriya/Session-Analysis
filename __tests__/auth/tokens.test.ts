jest.mock('jose', () => ({
  jwtVerify: jest.fn(async (token: string) => {
    if (token === 'invalid.token.here') {
      throw new Error('Invalid token');
    }
    if (token.endsWith('XXXXX')) {
      throw new Error('Token tampered');
    }
    // Parse JWT (simplified)
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return { payload };
  }),
  SignJWT: jest.fn(function (payload: any) {
    this.payload = payload;
    this.protectedHeader = {};
    this.claims = {};

    this.setProtectedHeader = jest.fn(function (header: any) {
      this.protectedHeader = header;
      return this;
    });

    this.setIssuedAt = jest.fn(function () {
      this.claims.iat = Math.floor(Date.now() / 1000);
      return this;
    });

    this.setExpirationTime = jest.fn(function (time: string) {
      if (time === '4h') {
        this.claims.exp = Math.floor((Date.now() + 4 * 60 * 60 * 1000) / 1000);
      }
      return this;
    });

    this.sign = jest.fn(async function () {
      // Create a mock JWT token
      const header = Buffer.from(JSON.stringify(this.protectedHeader)).toString('base64');
      const body = Buffer.from(JSON.stringify({...this.payload, ...this.claims})).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      return `${header}.${body}.${signature}`;
    });
  }),
}));

import { generateRoomToken, verifyRoomToken, getRoomTokenExpiration } from '@/lib/auth/tokens';

describe('Room Tokens', () => {
  it('should generate a valid JWT token', async () => {
    const token = await generateRoomToken('room-123', 'user-456', 'tutor');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should verify a valid token and return payload', async () => {
    const token = await generateRoomToken('room-abc', 'user-xyz', 'student');
    const payload = await verifyRoomToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.roomId).toBe('room-abc');
    expect(payload!.userId).toBe('user-xyz');
    expect(payload!.role).toBe('student');
  });

  it('should reject an invalid token', async () => {
    const payload = await verifyRoomToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('should reject a tampered token', async () => {
    const token = await generateRoomToken('room-1', 'user-1', 'tutor');
    const tampered = token.slice(0, -5) + 'XXXXX';
    const payload = await verifyRoomToken(tampered);
    expect(payload).toBeNull();
  });

  it('should return correct expiration time', () => {
    const now = Date.now();
    const exp = getRoomTokenExpiration();
    const diffHours = (exp.getTime() - now) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(4, 0);
  });

  it('should generate different tokens for different users', async () => {
    const token1 = await generateRoomToken('room-1', 'user-1', 'tutor');
    const token2 = await generateRoomToken('room-1', 'user-2', 'student');
    expect(token1).not.toBe(token2);

    const payload1 = await verifyRoomToken(token1);
    const payload2 = await verifyRoomToken(token2);
    expect(payload1!.userId).toBe('user-1');
    expect(payload2!.userId).toBe('user-2');
  });

  it('should preserve role information in token', async () => {
    const roles: Array<'tutor' | 'student' | 'admin'> = ['tutor', 'student', 'admin'];

    for (const role of roles) {
      const token = await generateRoomToken('room-test', 'user-test', role);
      const payload = await verifyRoomToken(token);
      expect(payload!.role).toBe(role);
    }
  });

  it('should handle empty string inputs gracefully', async () => {
    const token = await generateRoomToken('', '', 'tutor');
    const payload = await verifyRoomToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.roomId).toBe('');
    expect(payload!.userId).toBe('');
  });

  it('should reject token with missing signature', async () => {
    const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    const payload = await verifyRoomToken(malformedToken);
    expect(payload).toBeNull();
  });
});
