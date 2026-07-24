import 'server-only';

// lib/scrape/middleware.ts
// Server-only security helpers for the scraping pipeline

import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Compare two strings using timing-safe comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.byteLength !== bBuf.byteLength) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify the x-devscout-admin-secret header matches the DEVSCOUT_ADMIN_SECRET env var.
 * This is a server-only check — never expose the secret to browser code.
 */
export function verifyAdminSecret(request: NextRequest): { valid: boolean; error?: string } {
  const secret = request.headers.get('x-devscout-admin-secret');
  const expected = process.env.DEVSCOUT_ADMIN_SECRET;

  if (!expected) {
    console.error('[Security] DEVSCOUT_ADMIN_SECRET environment variable is not set');
    return { valid: false, error: 'Server configuration error' };
  }

  if (!secret) {
    return { valid: false, error: 'Missing x-devscout-admin-secret header' };
  }

  if (!timingSafeEqual(secret, expected)) {
    return { valid: false, error: 'Invalid admin secret' };
  }

  return { valid: true };
}
