import { NextResponse } from 'next/server';
import { dbQuery, dbWrite, dbRawQuery } from '@/lib/database';
import { requireAuth, hashPassword, logAuditEvent } from '@/lib/auth';

/**
 * GET /api/users/[id]
 */
export async function GET(request, { params }) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const result = await dbRawQuery(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.role_id, r.name as role, u.status, u.last_login, u.created_at ` +
      `FROM users u LEFT JOIN roles r ON u.role_id = r.id ` +
      `WHERE u.id = ${userId} LIMIT 1`
    );

    if (!result.data?.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result.data[0] });
  } catch (error) {
    console.error('[API] Get user error:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PUT /api/users/[id]
 *
 * Update user fields. Requires admin or users.manage permission.
 * Body: { first_name?, last_name?, email?, username?, role_id?, status?, password? }
 */
export async function PUT(request, { params }) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = session.role?.name === 'admin';
    const canManageUsers = session.permissions.includes('users.manage');
    if (!isAdmin && !canManageUsers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await request.json();
    const updateData = {};

    // Build update payload from allowed fields
    if (body.first_name !== undefined) updateData.first_name = body.first_name.trim();
    if (body.last_name !== undefined) updateData.last_name = body.last_name.trim();
    if (body.username !== undefined) updateData.username = body.username.trim();
    if (body.role_id !== undefined) updateData.role_id = body.role_id;
    if (body.status !== undefined) updateData.status = body.status;

    // Email change — check for duplicates
    if (body.email !== undefined) {
      const emailLower = body.email.toLowerCase().trim();
      const existing = await dbRawQuery(
        `SELECT id FROM users WHERE email = '${emailLower.replace(/'/g, "\\'")}' AND id != ${userId} LIMIT 1`
      );
      if (existing.data?.length > 0) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
      }
      updateData.email = emailLower;
    }

    // Username change — check for duplicates
    if (body.username !== undefined) {
      const existing = await dbRawQuery(
        `SELECT id FROM users WHERE username = '${body.username.trim().replace(/'/g, "\\'")}' AND id != ${userId} LIMIT 1`
      );
      if (existing.data?.length > 0) {
        return NextResponse.json({ error: 'A user with this username already exists' }, { status: 409 });
      }
    }

    // Password reset
    if (body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      updateData.password_hash = await hashPassword(body.password);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await dbWrite('users', 'update', updateData, { id: userId });

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to update user' }, { status: 500 });
    }

    // Log audit event
    await logAuditEvent(session.user.id, 'user_updated', {
      target_user_id: userId,
      fields_changed: Object.keys(updateData).filter(k => k !== 'updated_at' && k !== 'password_hash'),
      password_reset: !!body.password,
    });

    return NextResponse.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('[API] Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id]
 *
 * Soft-delete: sets user status to 'inactive'.
 * Hard-delete: permanently removes user when ?permanent=true is passed.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = session.role?.name === 'admin';
    const canManageUsers = session.permissions.includes('users.manage');
    if (!isAdmin && !canManageUsers) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // Prevent self-deletion/deactivation
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    if (permanent) {
      // Hard delete — permanently remove from database
      const result = await dbWrite('users', 'delete', null, { id: userId });

      if (!result.success) {
        return NextResponse.json({ error: result.message || 'Failed to delete user' }, { status: 500 });
      }

      // Log audit event
      await logAuditEvent(session.user.id, 'user_deleted', {
        target_user_id: userId,
      });

      return NextResponse.json({ success: true, message: 'User permanently deleted' });
    } else {
      // Soft delete — set status to inactive
      const result = await dbWrite('users', 'update', {
        status: 'inactive',
        updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      }, { id: userId });

      if (!result.success) {
        return NextResponse.json({ error: result.message || 'Failed to deactivate user' }, { status: 500 });
      }

      // Log audit event
      await logAuditEvent(session.user.id, 'user_deactivated', {
        target_user_id: userId,
      });

      return NextResponse.json({ success: true, message: 'User deactivated successfully' });
    }
  } catch (error) {
    console.error('[API] Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
