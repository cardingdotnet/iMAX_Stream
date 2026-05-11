/**
 * Stream Resolver Endpoint
 * 
 * GET /api/stream-resolve/[trackId]
 *   Default: 302 redirect to actual SoundCloud stream URL
 *   ?format=json: Returns { url, type } JSON for web player
 *   ?debug=1: Returns full resolution info (for troubleshooting)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSoundCloudClient } from '@/lib/soundcloud/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const { trackId: trackIdStr } = await params;
  const trackId = parseInt(trackIdStr, 10);

  if (!trackId || isNaN(trackId)) {
    return new NextResponse('Invalid track ID', { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format');
  const debug = searchParams.get('debug') === '1';
  const wantJson = format === 'json';

  // Skip noisy per-track logs in production; keep for debug.
  if (debug) {
    console.log(`[stream-resolve] Resolving track ${trackId} (json=${wantJson})`);
  }

  try {
    const sc = getSoundCloudClient();
    
    // For external M3U players: prefer progressive MP3 (works as direct URL)
    // For web player JSON: also prefer progressive, HLS as fallback (handled by hls.js)
    const result = await sc.resolveStreamUrlWithType(trackId, true);

    if (!result || !result.url) {
      console.error(`[stream-resolve] No stream URL found for track ${trackId}`);
      
      if (debug) {
        return NextResponse.json(
          { error: 'No stream URL', trackId, result: null },
          { status: 404 }
        );
      }
      return new NextResponse(
        `Stream not available for track ${trackId}. The track may have HLS-only streams or be region-restricted.`, 
        { status: 404 }
      );
    }

    console.log(`[stream-resolve] Track ${trackId} → type=${result.type}`);

    if (debug) {
      return NextResponse.json({
        trackId,
        type: result.type,
        url: result.url,
        isHls: result.type === 'hls',
        warning: result.type === 'hls' 
          ? 'HLS streams may not work in all M3U players (VLC supports them, IMVU may not)'
          : null,
      });
    }

    if (wantJson) {
      return NextResponse.json(
        { url: result.url, type: result.type },
        {
          headers: {
            'Cache-Control': 'no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // External players: 302 redirect
    return NextResponse.redirect(result.url, {
      status: 302,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error(`[stream-resolve] Error for track ${trackId}:`, error.message);
    
    if (debug) {
      return NextResponse.json(
        { 
          error: error.message,
          stack: error.stack,
          trackId 
        },
        { status: 500 }
      );
    }
    return new NextResponse(
      `Failed to resolve stream: ${error.message}`, 
      { status: 500 }
    );
  }
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> }
) {
  const response = await GET(request, context);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    },
  });
}
