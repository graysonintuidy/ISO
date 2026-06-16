import { NextResponse } from 'next/server';
import { dbQuery, dbWrite, dbRawQuery } from '@/lib/database';
import { requireAuth, logAuditEvent } from '@/lib/auth';

/**
 * GET /api/roles
 *
 * List all roles with user counts.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get roles with user counts
    const result = await dbRawQuery(
      `SELECT r.*, COUNT(u.id) as user_count ` +
      `FROM roles r LEFT JOIN users u ON u.role_id = r.id AND u.status = 'active' ` +
      `GROUP BY r.id ORDER BY r.id ASC`
    );

    // Parse permissions JSON for each role
    const roles = (result.data || []).map(role => {
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
      return { ...role, permissions };
    });

    return NextResponse.json({ data: roles, total: roles.length });
  } catch (error) {
    console.error('[API] Roles error:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

/**
 * POST /api/roles
 *
 * Create a new role. Requires admin or roles.manage permission.
 * Body: { name, description?, permissions: string[] }
 */
export async function POST(request) {
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

    const body = await request.json();
    const { name, description, permissions } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check for duplicate role name
    const existing = await dbQuery('roles', {
      where: { name: name.toLowerCase().trim() },
      select: 'id',
      limit: 1,
    });
    if (existing.data?.length > 0) {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 });
    }

    const result = await dbWrite('roles', 'insert', {
      name: name.toLowerCase().trim(),
      description: description?.trim() || null,
      permissions: JSON.stringify(permissions || []),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to create role' }, { status: 500 });
    }

    await logAuditEvent(session.user.id, 'role_created', {
      role_name: name,
      permissions: permissions || [],
    });

    return NextResponse.json({
      success: true,
      id: result.id,
      message: 'Role created successfully',
    });
  } catch (error) {
    console.error('[API] Create role error:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
