import { NextResponse } from 'next/server';
import { getProductionLines } from '@/lib/database';
import { dbWrite } from '@/lib/database';

/**
 * GET /api/production-lines?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await getProductionLines(facilityId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Production lines error:', error);
    return NextResponse.json({ error: 'Failed to fetch production lines' }, { status: 500 });
  }
}

/**
 * POST /api/production-lines
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('production_lines', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create production line error:', error);
    return NextResponse.json({ error: 'Failed to create production line' }, { status: 500 });
  }
}
