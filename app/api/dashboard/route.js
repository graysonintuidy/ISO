import { NextResponse } from 'next/server';
import { getDashboardStats, getAlerts, getIncidents, getProductionLines, getCameras } from '@/lib/database';

/**
 * GET /api/dashboard?facilityId=1
 * Returns all dashboard data for a facility in a single request.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const [stats, alerts, incidents, productionLines, cameras] = await Promise.all([
      getDashboardStats(facilityId),
      getAlerts(facilityId, { limit: 10 }),
      getIncidents(facilityId, { limit: 15 }),
      getProductionLines(facilityId),
      getCameras(facilityId),
    ]);

    return NextResponse.json({
      stats,
      alerts: alerts.data,
      incidents: incidents.data,
      productionLines: productionLines.data,
      cameras: cameras.data,
    });
  } catch (error) {
    console.error('[API] Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
