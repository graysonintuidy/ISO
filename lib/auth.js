/**
 * Authentication & Authorization Library
 * 
 * Provides JWT-based session management, password hashing,
 * role/permission checks, and audit logging.
 * 
 * Uses:
 *  - jose (JWT signing/verification)
 *  - bcryptjs (password hashing)
 *  - next/headers cookies (async, Next.js 16+)
 */

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { dbQuery, dbWrite, dbRawQuery } from './database';

// ── Constants ─────────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'nb-monitor-jwt-secret-change-in-production-2024'
);
const SESSION_COOKIE = 'nb_session';
const SESSION_DURATION_HOURS = parseInt(process.env.SESSION_DURATION_HOURS || '24', 10);
const BCRYPT_ROUNDS = 10;

// ── Password Hashing ──────────────────────────────────────────────

/**
 * Hash a plaintext password with bcrypt.
 * @param {string} password
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ── JWT / Session Management ──────────────────────────────────────

/**
 * Create a JWT for the given user and set it as an httpOnly cookie.
 * Also records the session in the `user_sessions` table.
 *
 * @param {object} user - User record from DB (must have id, email, role_id)
 * @param {object} [meta] - Optional metadata (ip, userAgent)
 * @returns {Promise<string>} The JWT token string
 */
export async function createSession(user, meta = {}) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  // Build JWT payload
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    roleId: user.role_id,
    role: user.role_name || 'viewer',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(JWT_SECRET);

  // Store session in DB
  try {
    await dbWrite('user_sessions', 'insert', {
      user_id: user.id,
      token_hash: await hashTokenForStorage(token),
      ip_address: meta.ip || null,
      user_agent: meta.userAgent ? meta.userAgent.slice(0, 500) : null,
      login_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      expires_at: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
      is_active: true,
    });
  } catch (e) {
    console.error('[auth] Failed to store session:', e.message);
  }

  // Set httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return token;
}

/**
 * Read the session cookie, verify the JWT, and return the current user
 * with their role and permissions.
 *
 * @returns {Promise<{user: object, role: object, permissions: string[]}|null>}
 */
export async function getSession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (!sessionCookie?.value) return null;

    const { payload } = await jwtVerify(sessionCookie.value, JWT_SECRET);
    if (!payload.userId) return null;

    // Fetch user from DB
    const userResult = await dbQuery('users', {
      where: { id: payload.userId },
      select: 'id, username, email, first_name, last_name, role_id, status, last_login',
      limit: 1,
    });

    const user = userResult.data?.[0];
    if (!user || user.status !== 'active') return null;

    // Fetch role info (roles table stores permissions as JSON array)
    let role = null;
    let permissions = [];
    if (user.role_id) {
      const roleResult = await dbQuery('roles', {
        where: { id: user.role_id },
        limit: 1,
      });
      role = roleResult.data?.[0] || null;

      // Parse permissions from JSON column in roles table
      if (role?.permissions) {
        const permsRaw = typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;
        permissions = Array.isArray(permsRaw) ? permsRaw : [];
      }
    }

    return { user, role, permissions };
  } catch (error) {
    // Token expired or invalid
    console.error('[auth] Session verification failed:', error.message);
    return null;
  }
}

/**
 * Destroy the current session — clear cookie and mark session inactive in DB.
 */
export async function destroySession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE);

    if (sessionCookie?.value) {
      // Mark session as inactive in DB
      const tokenHash = await hashTokenForStorage(sessionCookie.value);
      await dbWrite(
        'user_sessions',
        'update',
        {
          is_active: false,
          logout_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        },
        { token_hash: tokenHash }
      );
    }

    // Delete the cookie
    cookieStore.delete(SESSION_COOKIE);
  } catch (error) {
    console.error('[auth] Failed to destroy session:', error.message);
    // Still try to delete the cookie
    try {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE);
    } catch { /* ignore */ }
  }
}

/**
 * Server-side auth guard. Returns the session or null.
 * Use in API routes / server components to check authentication.
 *
 * @returns {Promise<{user: object, role: object, permissions: string[]}|null>}
 */
export async function requireAuth() {
  const session = await getSession();
  return session;
}

/**
 * Check if the current user has a specific permission.
 *
 * @param {string} permission - Permission key (e.g., 'cameras.view')
 * @returns {Promise<boolean>}
 */
export async function hasPermission(permission) {
  const session = await getSession();
  if (!session) return false;
  // Admins have all permissions
  if (session.role?.name === 'admin') return true;
  return session.permissions.includes(permission);
}

// ── Audit Logging ─────────────────────────────────────────────────

/**
 * Log an audit event.
 *
 * @param {number|null} userId - User who performed the action (null for failed logins)
 * @param {string} action - Action type (e.g., 'login', 'logout', 'login_failed')
 * @param {object} [details] - Additional details
 */
export async function logAuditEvent(userId, action, details = {}) {
  try {
    await dbWrite('audit_log', 'insert', {
      facility_id: 1,
      user_id: userId,
      action_type: action,
      entity_type: 'auth',
      details: JSON.stringify(details),
      ip_address: details.ip || null,
    });
  } catch (error) {
    console.error('[auth] Failed to log audit event:', error.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Create a simple hash of the JWT token for storage in the sessions table.
 * We don't store the raw token — just enough to match it for logout.
 */
async function hashTokenForStorage(token) {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
