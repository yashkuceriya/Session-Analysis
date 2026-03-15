import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { hasUser, addUser } from '@/lib/auth/user-store.server';
import { rateLimit } from '@/lib/auth/rate-limit';

interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'tutor' | 'student';
}

/**
 * Password strength validator
 * Requirements: min 8 chars, 1 uppercase, 1 number
 */
function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Email validation regex
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Rate limiting: 5 registration attempts per IP per 15 minutes
    const rateLimitResult = rateLimit(`register:${clientIp}`, 5, 15 * 60 * 1000);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body: RegisterRequest = await request.json();

    // Validate required fields
    if (!body.name?.trim() || !body.email?.trim() || !body.password || !body.role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, role' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(body.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Validate password confirmation
    if (body.password !== body.confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['tutor', 'student'].includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "tutor" or "student"' },
        { status: 400 }
      );
    }

    // Check if user already exists
    if (hasUser(body.email)) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(body.password, salt);

    // Create user
    const userId = randomUUID();
    addUser({
      id: userId,
      email: body.email.toLowerCase(),
      name: body.name.trim(),
      password: hashedPassword,
      role: body.role,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful. Please sign in.',
        user: {
          id: userId,
          email: body.email.toLowerCase(),
          name: body.name.trim(),
          role: body.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
