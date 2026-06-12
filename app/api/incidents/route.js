import { NextResponse } from 'next/server';
import { getIncidents } from '@/lib/database';
import { dbWrite } from '@/lib/database';

/**
 * GET /api/incidents?facilityId=1&limit=20
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getIncidents(facilityId, { limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Incidents error:', error);
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
  }
}

/**
 * POST /api/incidents
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('incidents', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create incident error:', error);
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 });
  }
}
