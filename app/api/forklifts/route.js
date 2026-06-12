import { NextResponse } from 'next/server';
import { dbQuery, dbWrite } from '@/lib/database';

/**
 * GET /api/forklifts?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await dbQuery('forklifts', {
      where: { facility_id: facilityId },
      orderBy: 'unit_number ASC',
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Forklifts error:', error);
    return NextResponse.json({ error: 'Failed to fetch forklifts' }, { status: 500 });
  }
}

/**
 * POST /api/forklifts
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('forklifts', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create forklift error:', error);
    return NextResponse.json({ error: 'Failed to create forklift' }, { status: 500 });
  }
}
