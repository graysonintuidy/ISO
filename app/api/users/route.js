import { NextResponse } from 'next/server';
import { dbQuery, dbWrite, dbRawQuery } from '@/lib/database';

/**
 * GET /api/users?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await dbRawQuery(
      `SELECT u.id, u.username, u.email, r.name as role, u.status, u.last_login, u.created_at ` +
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
 */
export async function POST(request) {
  try {
    const body = await request.json();
    // In production, password would be hashed here
    const result = await dbWrite('users', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
