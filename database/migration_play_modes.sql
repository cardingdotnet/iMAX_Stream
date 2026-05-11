-- =====================================================
-- Migration: Per-playlist default play mode
--
-- Adds `default_play_mode` to playlists. This drives the order in which
-- tracks play on:
--   1. The IMVU radio broadcast (/radio/{code}.mp3) — the SHARED timeline
--      is computed from this order, so every listener hears the same song.
--   2. The web player when a visitor presses "Play all" without an
--      explicit mode (the playlist page uses 'sequential' there by design;
--      the "Smart shuffle" button uses 'smart-shuffle' regardless).
--
-- Allowed values match the lib/playlist/play-modes.ts enum exactly. We
-- enforce that with a CHECK constraint so a typo doesn't silently break
-- the radio (the route would fall back to 'sequential', but better to
-- catch it at the DB layer).
--
-- IMPORTANT: changing the mode also resets `broadcast_started_at` so the
-- shared timeline restarts in the new order. Otherwise existing listeners
-- would suddenly hear a different track than the one their position
-- computes to. This is handled by the `set_default_play_mode` function
-- below — owners should call it instead of UPDATE-ing the column directly.
-- =====================================================

ALTER TABLE public.playlists
    ADD COLUMN IF NOT EXISTS default_play_mode TEXT
        NOT NULL DEFAULT 'sequential';

ALTER TABLE public.playlists
    DROP CONSTRAINT IF EXISTS playlists_default_play_mode_check;

ALTER TABLE public.playlists
    ADD CONSTRAINT playlists_default_play_mode_check
    CHECK (default_play_mode IN (
        'sequential',
        'smart-shuffle',
        'by-artist',
        'by-genre',
        'longest-first',
        'shortest-first',
        'recently-added'
    ));

-- Update the playlist-by-code RPC to also return the mode in one round trip.
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
    track_genre TEXT,
    broadcast_started_at TIMESTAMPTZ,
    default_play_mode TEXT
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
        t.genre,
        p.broadcast_started_at,
        p.default_play_mode
    FROM public.playlists p
    JOIN public.playlist_tracks pt ON pt.playlist_id = p.id
    JOIN public.tracks t ON t.id = pt.track_id
    WHERE p.short_code = p_code OR p.slug = p_code
    ORDER BY pt.position ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Owner-only setter. Validates against the enum, updates the mode, AND
-- resets the broadcast epoch so the synchronized timeline restarts in the
-- new order. Returns the new mode on success, NULL on auth/validation fail.
CREATE OR REPLACE FUNCTION public.set_default_play_mode(
    p_code TEXT,
    p_user_id UUID,
    p_mode TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_mode NOT IN (
        'sequential',
        'smart-shuffle',
        'by-artist',
        'by-genre',
        'longest-first',
        'shortest-first',
        'recently-added'
    ) THEN
        RETURN NULL;
    END IF;

    UPDATE public.playlists
       SET default_play_mode = p_mode,
           broadcast_started_at = NULL
     WHERE (short_code = p_code OR slug = p_code)
       AND user_id = p_user_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
        RETURN NULL;
    END IF;
    RETURN p_mode;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
