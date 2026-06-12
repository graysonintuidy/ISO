import { NextResponse } from 'next/server';
import { getCameras } from '@/lib/database';
import { dbWrite } from '@/lib/database';

/**
 * GET /api/cameras?facilityId=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get('facilityId') || 1;

    const result = await getCameras(facilityId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Cameras error:', error);
    return NextResponse.json({ error: 'Failed to fetch cameras' }, { status: 500 });
  }
}

/**
 * POST /api/cameras
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const result = await dbWrite('cameras', 'insert', body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Create camera error:', error);
    return NextResponse.json({ error: 'Failed to create camera' }, { status: 500 });
  }
}
