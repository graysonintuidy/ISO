import { NextResponse } from 'next/server';
import { getSession, destroySession, logAuditEvent } from '@/lib/auth';

/**
 * POST /api/auth/logout
 * 
 * Destroys the current session and logs the event.
 */
export async function POST() {
  try {
    const session = await getSession();

    // Destroy session (clears cookie + marks DB record inactive)
    await destroySession();

    // Log the event
    if (session?.user) {
      await logAuditEvent(session.user.id, 'logout', {
        email: session.user.email,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Logout error:', error);
    // Even if something fails, try to clear the cookie
    return NextResponse.json({ success: true });
  }
}
