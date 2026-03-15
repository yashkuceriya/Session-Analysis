import { rateLimit, resetRateLimit, cleanupRateLimitStore } from '@/lib/auth/rate-limit';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear any previous rate limit entries by resetting all keys
    resetRateLimit('test-key');
    resetRateLimit('test-key-2');
    resetRateLimit('test-key-3');
  });

  it('should allow requests within limit', () => {
    const result1 = rateLimit('test-user', 5, 60000);
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(4);

    const result2 = rateLimit('test-user', 5, 60000);
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(3);
  });

  it('should block requests over limit', () => {
    const limit = 3;
    // Make 3 successful requests
    rateLimit('test-user-block', limit, 60000);
    rateLimit('test-user-block', limit, 60000);
    rateLimit('test-user-block', limit, 60000);

    // Fourth request should fail
    const result = rateLimit('test-user-block', limit, 60000);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track remaining requests correctly', () => {
    const limit = 5;
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(rateLimit('test-remaining', limit, 60000));
    }

    expect(results[0].remaining).toBe(4);
    expect(results[1].remaining).toBe(3);
    expect(results[2].remaining).toBe(2);
    expect(results[3].remaining).toBe(1);
    expect(results[4].remaining).toBe(0);
  });

  it('should reset after window expires', () => {
    jest.useFakeTimers();

    const key = 'test-window';
    const windowMs = 5000;

    // Make a request
    const result1 = rateLimit(key, 3, windowMs);
    expect(result1.success).toBe(true);
    expect(result1.remaining).toBe(2);

    // Advance time past window
    jest.advanceTimersByTime(windowMs + 1);

    // Should reset and allow new requests
    const result2 = rateLimit(key, 3, windowMs);
    expect(result2.success).toBe(true);
    expect(result2.remaining).toBe(2);

    jest.useRealTimers();
  });

  it('should isolate limits between different keys', () => {
    const limit = 2;

    // User A makes 2 requests
    rateLimit('user-a', limit, 60000);
    const resultA = rateLimit('user-a', limit, 60000);
    expect(resultA.remaining).toBe(0);

    // User B should have separate limit
    const resultB1 = rateLimit('user-b', limit, 60000);
    expect(resultB1.success).toBe(true);
    expect(resultB1.remaining).toBe(1);

    const resultB2 = rateLimit('user-b', limit, 60000);
    expect(resultB2.success).toBe(true);
    expect(resultB2.remaining).toBe(0);
  });

  it('should return success but reject with zero remaining', () => {
    const limit = 2;
    const key = 'test-zero';

    rateLimit(key, limit, 60000);
    rateLimit(key, limit, 60000);
    const thirdResult = rateLimit(key, limit, 60000);

    expect(thirdResult.success).toBe(false);
    expect(thirdResult.remaining).toBe(0);
  });

  it('should handle default window size', () => {
    // Default is 60 seconds, should work without explicit window
    const result = rateLimit('test-default', 5);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should handle very large limits', () => {
    const largeLimit = 10000;
    const results = [];

    for (let i = 0; i < 100; i++) {
      results.push(rateLimit('test-large-limit', largeLimit, 60000));
    }

    expect(results[0].success).toBe(true);
    expect(results[99].success).toBe(true);
    expect(results[99].remaining).toBe(largeLimit - 100);
  });

  it('should handle very small window sizes', () => {
    jest.useFakeTimers();

    const key = 'test-small-window';
    const windowMs = 100; // 100ms window

    const result1 = rateLimit(key, 2, windowMs);
    expect(result1.success).toBe(true);

    // Advance by 50ms (still within window)
    jest.advanceTimersByTime(50);
    const result2 = rateLimit(key, 2, windowMs);
    expect(result2.success).toBe(true);

    // Advance by 51ms more (past window)
    jest.advanceTimersByTime(51);
    const result3 = rateLimit(key, 2, windowMs);
    expect(result3.success).toBe(true);
    expect(result3.remaining).toBe(1); // Reset, so 2-1 = 1

    jest.useRealTimers();
  });

  it('should reset rate limit for a key', () => {
    const key = 'test-reset';

    rateLimit(key, 3, 60000);
    rateLimit(key, 3, 60000);
    let result = rateLimit(key, 3, 60000);
    expect(result.remaining).toBe(0);

    // Reset the key
    resetRateLimit(key);

    // Now should allow new requests
    result = rateLimit(key, 3, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should cleanup expired entries', () => {
    jest.useFakeTimers();

    const key1 = 'test-cleanup-1';
    const key2 = 'test-cleanup-2';
    const windowMs = 1000;

    // Create entry 1
    rateLimit(key1, 5, windowMs);

    // Advance time
    jest.advanceTimersByTime(500);

    // Create entry 2
    rateLimit(key2, 5, windowMs);

    // Advance time past key1's window expiry
    jest.advanceTimersByTime(600);

    // Run cleanup
    cleanupRateLimitStore();

    // key1 should be cleaned up, key2 should still exist
    // Create new entry with key1 to test it was reset
    const resultKey1 = rateLimit(key1, 5, windowMs);
    expect(resultKey1.remaining).toBe(4); // Fresh, so 5-1 = 4

    jest.useRealTimers();
  });
});
