import { NextResponse } from 'next/server';
import { dbQuery, dbWrite } from '@/lib/database';

/**
 * GET /api/zones?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await dbQuery('zones', {
      where: { facility_id: facilityId },
      orderBy: 'name ASC',
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Zones error:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}

/**
 * POST /api/zones
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('zones', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create zone error:', error);
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
  }
}
