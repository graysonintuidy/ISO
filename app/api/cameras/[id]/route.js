import { NextResponse } from 'next/server';
import DEMO_CAMERA_FEEDS from '@/lib/demoCameraFeeds';

/**
 * GET /api/cameras/[id]
 * Returns a single camera's details including mock events.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Check if this is a demo camera
    const demoCamera = DEMO_CAMERA_FEEDS.find((c) => c.id === id);

    const camera = demoCamera
      ? {
          ...demoCamera,
          resolution: '1920×1080',
          fps: 30,
          codec: 'H.264',
          stream_url: null,
          uptime: demoCamera.status === 'online' ? '14d 6h 32m' : null,
          last_seen: demoCamera.status === 'online' ? new Date().toISOString() : null,
          facility_id: 1,
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        }
      : {
          id,
          name: `Camera ${id}`,
          location_description: 'Main Floor — Line 1',
          camera_type: 'fixed',
          zone: 'Floor',
          status: 'pending_setup',
          resolution: '1920×1080',
          fps: 30,
          codec: 'H.264',
          stream_url: null,
          image: null,
          uptime: null,
          last_seen: null,
          facility_id: 1,
          created_at: new Date().toISOString(),
        };

    // Simulated recent events for this camera
    const mockEvents = [
      {
        id: 'evt-1',
        type: 'motion_detected',
        description: 'Motion detected in camera field of view',
        severity: 'low',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-2',
        type: 'zone_entry',
        description: 'Person entered monitored safety zone',
        severity: 'medium',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-3',
        type: 'ppe_violation',
        description: 'PPE violation detected — missing hard hat',
        severity: 'high',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-4',
        type: 'forklift_proximity',
        description: 'Forklift detected near pedestrian walkway',
        severity: 'critical',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: 'evt-5',
        type: 'line_stoppage',
        description: 'Production line stopped — camera monitoring active',
        severity: 'medium',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json({
      camera,
      events: mockEvents,
    });
  } catch (error) {
    console.error('[API] Camera detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch camera details' },
      { status: 500 }
    );
  }
}

