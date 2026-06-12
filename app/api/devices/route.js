import { NextResponse } from 'next/server';
import { getDevices } from '@/lib/database';
import { dbWrite } from '@/lib/database';

/**
 * GET /api/devices?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await getDevices(facilityId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Devices error:', error);
    return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
}

/**
 * POST /api/devices
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('iot_devices', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create device error:', error);
    return NextResponse.json({ error: 'Failed to create device' }, { status: 500 });
  }
}
