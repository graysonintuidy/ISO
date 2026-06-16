import { NextResponse } from 'next/server';
import { dbQuery, dbWrite, dbRawQuery } from '@/lib/database';
import { requireAuth, hashPassword, logAuditEvent } from '@/lib/auth';

/**
 * GET /api/users?facilityId=1
 */
export async function GET(request) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await dbRawQuery(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, r.name as role, u.role_id, u.status, u.last_login, u.created_at ` +
      `FROM users u LEFT JOIN roles r ON u.role_id = r.id ` +
      `WHERE u.organization_id = ${parseInt(facilityId, 10)} ` +
      `ORDER BY u.created_at DESC LIMIT 50`
    );
    return NextResponse.json({ data: result.data, total: result.total });
  } catch (error) {
    console.error('[API] Users error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

/**
 * POST /api/users
 *
 * Create a new user. Requires admin or users.manage permission.
 * Body: { username, email, password, first_name, last_name, role_id, status? }
 */
export async function POST(request) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check permission
    const isAdmin = session.role?.name === 'admin';
    const canManageUsers = session.permissions.includes('users.manage');
    if (!isAdmin && !canManageUsers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { username, email, password, first_name, last_name, role_id, status } = body;

    // Validate required fields
    if (!username || !email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'All fields are required: username, email, password, first_name, last_name' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingEmail = await dbQuery('users', {
      where: { email: email.toLowerCase().trim() },
      select: 'id',
      limit: 1,
    });
    if (existingEmail.data?.length > 0) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    // Check for duplicate username
    const existingUsername = await dbQuery('users', {
      where: { username: username.trim() },
      select: 'id',
      limit: 1,
    });
    if (existingUsername.data?.length > 0) {
      return NextResponse.json({ error: 'A user with this username already exists' }, { status: 409 });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert user
    const result = await dbWrite('users', 'insert', {
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password_hash,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      role_id: role_id || null,
      status: status || 'active',
      organization_id: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to create user' }, { status: 500 });
    }

    // Log audit event
    await logAuditEvent(session.user.id, 'user_created', {
      target_user: username,
      target_email: email,
      role_id,
    });

    return NextResponse.json({
      success: true,
      id: result.id,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('[API] Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
