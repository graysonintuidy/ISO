import { NextResponse } from 'next/server';
import { dbRawQuery, dbWrite } from '@/lib/database';

/**
 * GET /api/zones/[id]
 * Returns a single zone's details + its incident history.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Query zone from DB
    const zoneResult = await dbRawQuery(
      `SELECT * FROM zones WHERE id = ${Number(id) || 0} LIMIT 1`
    );

    if (zoneResult.data.length === 0) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const row = zoneResult.data[0];
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});

    const zone = {
      id: row.id,
      name: row.name,
      zone_type: row.zone_type,
      type: row.zone_type === 'restricted' ? 'restricted'
        : row.zone_type === 'hazardous' ? 'caution'
        : row.zone_type === 'authorized' ? 'emergency'
        : 'general',
      camera: metadata.camera || 'Unknown',
      image: metadata.image || '/camera-feeds/cam-01.png',
      location: metadata.location || row.name,
      status: metadata.status || 'clear',
      severity: metadata.severity || 'low',
      zoneColor: row.color || '#FF0000',
      description: metadata.description || '',
      breachCount: metadata.breachCount || 0,
      todayBreaches: metadata.todayBreaches || 0,
      lastBreach: metadata.lastBreach || null,
      facility_id: row.facility_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Query incidents for this zone — check both zone_id column and metadata zoneName
    // (seed data stores zone association in metadata.zoneName, not zone_id)
    const zoneName = zone.name.replace(/'/g, "\\'");
    const incidentsResult = await dbRawQuery(
      `SELECT * FROM incidents WHERE (zone_id = ${Number(id) || 0} OR metadata LIKE '%${zoneName}%') AND facility_id = ${row.facility_id} ORDER BY created_at DESC LIMIT 50`
    );

    const incidents = incidentsResult.data.map((inc) => {
      const meta = typeof inc.metadata === 'string' ? JSON.parse(inc.metadata) : (inc.metadata || {});
      return {
        id: inc.id,
        zoneId: inc.zone_id,
        zoneName: meta.zoneName || zone.name,
        camera: meta.camera || zone.camera,
        timestamp: inc.created_at,
        severity: inc.severity,
        type: inc.incident_type === 'unauthorized_access' ? 'unauthorized_entry'
          : inc.incident_type === 'zone_breach' ? 'boundary_breach'
          : inc.incident_type,
        description: inc.description || inc.title,
        person: meta.person || 'Unknown',
        duration: meta.duration || 'N/A',
        status: inc.status === 'open' ? 'unresolved'
          : inc.status === 'investigating' ? 'acknowledged'
          : 'resolved',
        image: meta.image || zone.image,
      };
    });

    return NextResponse.json({ zone, incidents });
  } catch (error) {
    console.error('[API] Zone detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zone details' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/zones/[id]
 * Update a zone's details.
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Build update data — only include fields that were sent
    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.zone_type !== undefined) updateData.zone_type = body.zone_type;
    if (body.color !== undefined) updateData.color = body.color;

    // Handle metadata updates — merge with existing
    if (body.metadata !== undefined) {
      updateData.metadata = JSON.stringify(body.metadata);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    const result = await dbWrite('zones', 'update', updateData, { id: Number(id) });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Update zone error:', error);
    return NextResponse.json(
      { error: 'Failed to update zone' },
      { status: 500 }
    );
  }
}
