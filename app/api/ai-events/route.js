import { NextResponse } from 'next/server';
import { dbRawQuery } from '@/lib/database';

/**
 * GET /api/ai-events?facilityId=1&cameraId=X&limit=20
 * Returns AI detection events.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;
    const cameraId = searchParams.get('cameraId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let sql = `SELECT * FROM ai_events WHERE facility_id = ${Number(facilityId)}`;
    if (cameraId) {
      sql += ` AND camera_id = ${Number(cameraId)}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const result = await dbRawQuery(sql);

    const events = result.data.map((evt) => {
      const meta = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : (evt.metadata || {});
      return {
        id: evt.id,
        camera_id: evt.camera_id,
        facility_id: evt.facility_id,
        event_type: evt.event_type,
        confidence: evt.confidence,
        frame_url: evt.frame_url,
        reviewed: evt.reviewed,
        false_positive: evt.false_positive,
        created_at: evt.created_at,
        // Parsed metadata fields
        object: meta.object || evt.event_type,
        description: meta.description || `${evt.event_type} detected`,
        action: meta.action || 'Flagged for review',
        severity: meta.severity || (evt.confidence >= 0.9 ? 'critical' : evt.confidence >= 0.8 ? 'warning' : 'info'),
      };
    });

    return NextResponse.json({
      data: events,
      total: result.total,
    });
  } catch (error) {
    console.error('[API] AI Events error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI events' },
      { status: 500 }
    );
  }
}
