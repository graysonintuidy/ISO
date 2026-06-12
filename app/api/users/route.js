import { NextResponse } from 'next/server';
import { dbQuery, dbWrite } from '@/lib/database';

/**
 * GET /api/users?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await dbQuery('users', {
      where: { organization_id: facilityId },
      orderBy: 'created_at DESC',
      select: 'id, username, email, role, status, last_login, created_at',
    });
    return NextResponse.json(result);
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
