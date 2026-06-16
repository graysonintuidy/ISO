import { NextResponse } from 'next/server';
import { dbQuery, dbWrite, dbRawQuery } from '@/lib/database';
import { requireAuth, logAuditEvent } from '@/lib/auth';

/**
 * GET /api/roles/[id]
 */
export async function GET(request, { params }) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    const result = await dbRawQuery(
      `SELECT r.*, COUNT(u.id) as user_count ` +
      `FROM roles r LEFT JOIN users u ON u.role_id = r.id AND u.status = 'active' ` +
      `WHERE r.id = ${roleId} GROUP BY r.id LIMIT 1`
    );

    if (!result.data?.length) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const role = result.data[0];
    let permissions = [];
    if (role.permissions) {
      try {
        permissions = typeof role.permissions === 'string'
          ? JSON.parse(role.permissions)
          : role.permissions;
      } catch {
        permissions = [];
      }
    }

    return NextResponse.json({ data: { ...role, permissions } });
  } catch (error) {
    console.error('[API] Get role error:', error);
    return NextResponse.json({ error: 'Failed to fetch role' }, { status: 500 });
  }
}

/**
 * PUT /api/roles/[id]
 *
 * Update role permissions. Requires admin or roles.manage.
 * Body: { name?, description?, permissions?: string[] }
 */
export async function PUT(request, { params }) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = session.role?.name === 'admin';
    const canManageRoles = session.permissions.includes('roles.manage');
    if (!isAdmin && !canManageRoles) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    // Prevent editing built-in admin role name
    const existingRole = await dbQuery('roles', {
      where: { id: roleId },
      select: 'name',
      limit: 1,
    });
    if (!existingRole.data?.length) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const body = await request.json();
    const updateData = {};

    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.permissions !== undefined) updateData.permissions = JSON.stringify(body.permissions);

    // Only allow name change for non-admin roles
    if (body.name !== undefined && existingRole.data[0].name !== 'admin') {
      updateData.name = body.name.toLowerCase().trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await dbWrite('roles', 'update', updateData, { id: roleId });

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to update role' }, { status: 500 });
    }

    await logAuditEvent(session.user.id, 'role_updated', {
      role_id: roleId,
      role_name: body.name || existingRole.data[0].name,
      fields_changed: Object.keys(updateData).filter(k => k !== 'updated_at'),
    });

    return NextResponse.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    console.error('[API] Update role error:', error);
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

/**
 * DELETE /api/roles/[id]
 *
 * Delete a role. Cannot delete built-in roles or roles with users assigned.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin = session.role?.name === 'admin';
    const canManageRoles = session.permissions.includes('roles.manage');
    if (!isAdmin && !canManageRoles) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    // Check if built-in role
    const builtInRoles = ['admin', 'manager', 'operator', 'viewer'];
    const roleResult = await dbQuery('roles', {
      where: { id: roleId },
      select: 'name',
      limit: 1,
    });
    if (!roleResult.data?.length) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }
    if (builtInRoles.includes(roleResult.data[0].name)) {
      return NextResponse.json({ error: 'Cannot delete built-in roles' }, { status: 400 });
    }

    // Check if any users are assigned to this role
    const usersWithRole = await dbQuery('users', {
      where: { role_id: roleId, status: 'active' },
      select: 'id',
      limit: 1,
    });
    if (usersWithRole.data?.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete role with active users. Reassign users first.' },
        { status: 400 }
      );
    }

    const result = await dbWrite('roles', 'delete', null, { id: roleId });

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to delete role' }, { status: 500 });
    }

    await logAuditEvent(session.user.id, 'role_deleted', {
      role_id: roleId,
      role_name: roleResult.data[0].name,
    });

    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('[API] Delete role error:', error);
    return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
  }
}
