import { NextResponse } from 'next/server';
import { dbRawQuery } from '@/lib/database';

/**
 * GET /api/cameras/[id]
 * Returns a single camera's details + recent AI events from the database.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Query camera from DB
    const cameraResult = await dbRawQuery(
      `SELECT * FROM cameras WHERE id = ${Number(id) || 0} LIMIT 1`
    );

    let camera;
    if (cameraResult.data.length > 0) {
      const row = cameraResult.data[0];
      // Parse JSON config/metadata columns
      const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});

      camera = {
        ...row,
        config,
        metadata,
        image: config.image || null,
        zone: config.zone || row.camera_type || 'Floor',
        resolution: config.resolution || '1920×1080',
        fps: config.fps || 30,
        codec: config.codec || 'H.264',
        uptime: row.status === 'online' ? (config.uptime || '14d 6h 32m') : null,
        last_seen: row.status === 'online' ? (row.last_heartbeat || new Date().toISOString()) : null,
        // AI-related fields for line cameras
        aiStatus: config.aiStatus || null,
        aiConfidence: config.aiConfidence || null,
        detections: config.detections || 0,
        cameraType: config.cameraType || row.camera_type,
        line: config.line || null,
        lineNumber: config.lineNumber || null,
      };
    } else {
      camera = {
        id,
        name: `Camera ${id}`,
        location_description: 'Unknown Location',
        camera_type: 'floor',
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
    }

    // Query recent AI events for this camera
    const eventsResult = await dbRawQuery(
      `SELECT * FROM ai_events WHERE camera_id = ${Number(id) || 0} ORDER BY created_at DESC LIMIT 10`
    );

    const events = eventsResult.data.map((evt) => {
      const meta = typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : (evt.metadata || {});
      return {
        id: `evt-${evt.id}`,
        type: evt.event_type,
        description: meta.description || `${evt.event_type} detected`,
        severity: evt.confidence >= 0.9 ? 'critical' : evt.confidence >= 0.8 ? 'high' : 'medium',
        timestamp: evt.created_at,
        confidence: Math.round((evt.confidence || 0) * 100),
        object: meta.object || evt.event_type,
        action: meta.action || 'Flagged for review',
        resolved: evt.reviewed || false,
        false_positive: evt.false_positive || false,
      };
    });

    return NextResponse.json({
      camera,
      events,
    });
  } catch (error) {
    console.error('[API] Camera detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch camera details' },
      { status: 500 }
    );
  }
}
