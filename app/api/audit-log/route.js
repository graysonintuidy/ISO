import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/database';

/**
 * GET /api/audit-log?facilityId=1&limit=50
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await dbQuery('audit_log', {
      where: { facility_id: facilityId },
      orderBy: 'created_at DESC',
      limit,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Audit log error:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
