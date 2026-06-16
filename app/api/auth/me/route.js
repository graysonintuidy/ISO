import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * GET /api/auth/me
 * 
 * Returns the current authenticated user's info, role, and permissions.
 * Returns 401 if not authenticated.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        firstName: session.user.first_name,
        lastName: session.user.last_name,
        role: session.role?.name || 'viewer',
        roleDisplayName: session.role?.name
          ? session.role.name.charAt(0).toUpperCase() + session.role.name.slice(1)
          : 'Viewer',
        lastLogin: session.user.last_login,
      },
      permissions: session.permissions,
    });
  } catch (error) {
    console.error('[API] Auth/me error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}
