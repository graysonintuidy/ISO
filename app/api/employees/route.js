import { NextResponse } from 'next/server';
import { getEmployees } from '@/lib/database';
import { dbWrite } from '@/lib/database';

/**
 * GET /api/employees?facilityId=1&limit=50
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await getEmployees(facilityId, { limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Employees error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

/**
 * POST /api/employees
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('employees', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create employee error:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
