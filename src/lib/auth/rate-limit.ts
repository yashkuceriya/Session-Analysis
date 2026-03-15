/* eslint-disable @typescript-eslint/no-explicit-any */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// TODO: Replace with Redis or database for distributed systems
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter using sliding window
 * @param key - Unique identifier (IP, user ID, email, etc.)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Object with success status and remaining requests
 */
export function rateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60 * 1000 // 1 minute default
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // If no entry exists or window has reset
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  // Increment counter
  entry.count += 1;
  const remaining = limit - entry.count;

  if (entry.count > limit) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining };
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => rateLimitStore.delete(key));
}

// Auto-cleanup every 5 minutes
if (typeof global !== 'undefined' && !(global as any).__rateLimitCleanupInitialized) {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
  (global as any).__rateLimitCleanupInitialized = true;
}
