import { NextResponse } from 'next/server';
import { dbQuery, dbWrite } from '@/lib/database';
import { verifyPassword, createSession, logAuditEvent } from '@/lib/auth';

/**
 * POST /api/auth/login
 * 
 * Validates email + password, creates a session, logs the event.
 * Body: { email, password, remember? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Look up user by email
    const userResult = await dbQuery('users', {
      where: { email: email.toLowerCase().trim() },
      select: 'id, username, email, password_hash, first_name, last_name, role_id, status',
      limit: 1,
    });

    const user = userResult.data?.[0];

    if (!user) {
      // Log failed attempt
      await logAuditEvent(null, 'login_failed', {
        email: email.toLowerCase().trim(),
        reason: 'User not found',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      await logAuditEvent(user.id, 'login_failed', {
        email: user.email,
        reason: 'Account suspended',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json(
        { error: 'Account is suspended. Contact your administrator.' },
        { status: 403 }
      );
    }

    // Verify password
    if (!user.password_hash) {
      return NextResponse.json(
        { error: 'Account not configured for password login' },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      await logAuditEvent(user.id, 'login_failed', {
        email: user.email,
        reason: 'Wrong password',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get role name for JWT
    let roleName = 'viewer';
    if (user.role_id) {
      const roleResult = await dbQuery('roles', {
        where: { id: user.role_id },
        select: 'name',
        limit: 1,
      });
      if (roleResult.data?.[0]?.name) {
        roleName = roleResult.data[0].name;
      }
    }

    // Create session (sets httpOnly cookie)
    const userForSession = { ...user, role_name: roleName };
    await createSession(userForSession, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
    });

    // Update last_login
    await dbWrite('users', 'update', {
      last_login: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }, { id: user.id });

    // Log success
    await logAuditEvent(user.id, 'login', {
      email: user.email,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });

    // Return user info (no password hash!)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: roleName,
      },
    });
  } catch (error) {
    console.error('[API] Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
