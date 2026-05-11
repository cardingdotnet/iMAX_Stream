-- =====================================================
-- Migration: Shared broadcast timeline (Icecast-style sync)
--
-- Adds `broadcast_started_at` to playlists. This is the wall-clock epoch
-- the radio timeline starts from. All listeners on /radio/{code}.mp3 use
-- the same epoch to compute "what should be playing right now," so a late
-- joiner drops into mid-track at the same moment the existing listeners
-- are hearing.
--
-- Semantics:
--   - NULL means the broadcast has never been started.
--   - The first listener to ever connect to /radio/{code}.mp3 will atomically
--     set this to NOW() (via `start_broadcast_if_unset`). After that it is
--     immutable until an explicit reset.
--   - The endpoint also exposes a `?reset=1` admin path (owner-only, future)
--     to clear it; not part of this migration.
-- =====================================================

ALTER TABLE public.playlists
    ADD COLUMN IF NOT EXISTS broadcast_started_at TIMESTAMPTZ;

-- Atomic "set if null and return final value." Single round-trip — no race
-- between two listeners connecting simultaneously, since the UPDATE is
-- conditional and Postgres serializes it.
CREATE OR REPLACE FUNCTION public.start_broadcast_if_unset(p_code TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_epoch TIMESTAMPTZ;
BEGIN
    -- Try to claim the epoch atomically. If the row already had a non-null
    -- value, the WHERE clause excludes it and the UPDATE returns nothing —
    -- we then fall through to a SELECT.
    UPDATE public.playlists
       SET broadcast_started_at = NOW()
     WHERE (short_code = p_code OR slug = p_code)
       AND broadcast_started_at IS NULL
    RETURNING broadcast_started_at INTO v_epoch;

    IF v_epoch IS NOT NULL THEN
        RETURN v_epoch;
    END IF;

    -- Either the playlist doesn't exist (returns NULL) or it was already set.
    SELECT broadcast_started_at INTO v_epoch
      FROM public.playlists
     WHERE short_code = p_code OR slug = p_code
     LIMIT 1;

    RETURN v_epoch;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing playlist lookup RPC to also return the epoch, so the
-- /radio/[code] endpoint can fetch playlist + epoch in one round trip.
DROP FUNCTION IF EXISTS public.get_playlist_by_short_code(TEXT);

CREATE OR REPLACE FUNCTION public.get_playlist_by_short_code(p_code TEXT)
RETURNS TABLE (
    playlist_id UUID,
    playlist_name TEXT,
    playlist_short_code TEXT,
    user_id UUID,
    track_id BIGINT,
    track_title TEXT,
    track_artist TEXT,
    track_duration_ms INTEGER,
    track_position INTEGER,
    broadcast_started_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.short_code,
        p.user_id,
        t.id,
        t.title,
        t.artist,
        t.duration_ms,
        pt.position,
        p.broadcast_started_at
    FROM public.playlists p
    JOIN public.playlist_tracks pt ON pt.playlist_id = p.id
    JOIN public.tracks t ON t.id = pt.track_id
    WHERE p.short_code = p_code OR p.slug = p_code
    ORDER BY pt.position ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Owner-only manual reset (idempotent). Useful when the playlist contents
-- change and the owner wants the timeline to restart cleanly.
CREATE OR REPLACE FUNCTION public.reset_broadcast(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.playlists
       SET broadcast_started_at = NULL
     WHERE (short_code = p_code OR slug = p_code)
       AND user_id = p_user_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
