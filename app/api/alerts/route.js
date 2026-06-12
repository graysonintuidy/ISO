import { NextResponse } from 'next/server';
import { getAlerts } from '@/lib/database';
import { dbWrite } from '@/lib/database';

/**
 * GET /api/alerts?facilityId=1&limit=20
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getAlerts(facilityId, { limit });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

/**
 * POST /api/alerts
 * Create a new alert. Body: { facilityId, alert_type, severity, title, message, source_type, source_id }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('alerts', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create alert error:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
