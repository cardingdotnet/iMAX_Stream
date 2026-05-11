-- =====================================================
-- Performance Migration
--
-- Run this AFTER schema.sql and migration_short_codes.sql.
--
-- Adds:
--   1. playlists.track_count (denormalized; trigger-maintained)
--   2. Composite indexes for common query paths
--   3. Atomic add_track_to_playlist() RPC (replaces 5 round trips with 1)
-- =====================================================

-- ---------------------------------------------------------------
-- 1. Denormalized track_count column on playlists
--    Replaces the expensive `playlist_tracks(count)` aggregation
--    PostgREST does for every row of /library, /api/playlists, etc.
-- ---------------------------------------------------------------
ALTER TABLE public.playlists
  ADD COLUMN IF NOT EXISTS track_count INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing data
UPDATE public.playlists p
SET track_count = (
  SELECT COUNT(*)::int
  FROM public.playlist_tracks pt
  WHERE pt.playlist_id = p.id
)
WHERE TRUE;

-- Trigger: keep playlists.track_count in sync.
CREATE OR REPLACE FUNCTION public.sync_playlist_track_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.playlists
       SET track_count = track_count + 1,
           updated_at  = NOW()
     WHERE id = NEW.playlist_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.playlists
       SET track_count = GREATEST(track_count - 1, 0),
           updated_at  = NOW()
     WHERE id = OLD.playlist_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_playlist_track_count ON public.playlist_tracks;
CREATE TRIGGER trg_sync_playlist_track_count
AFTER INSERT OR DELETE ON public.playlist_tracks
FOR EACH ROW EXECUTE FUNCTION public.sync_playlist_track_count();

-- ---------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------

-- Library page sorts by updated_at within a single user → composite covers it.
CREATE INDEX IF NOT EXISTS idx_playlists_user_updated
  ON public.playlists(user_id, updated_at DESC);

-- get_playlist_by_short_code() does:  WHERE short_code = ? OR slug = ?
-- short_code already has a unique index. Add slug too for the OR branch.
CREATE INDEX IF NOT EXISTS idx_playlists_slug
  ON public.playlists(slug);

-- playlist_tracks JOIN to tracks uses track_id; needed for cascading
-- deletes & for the radio endpoint's RPC.
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id
  ON public.playlist_tracks(track_id);

-- Trigram index for case-insensitive title search across all languages
-- (the existing GIN tsvector is English-only, so Arabic queries miss it).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm
  ON public.tracks USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_trgm
  ON public.tracks USING gin(artist gin_trgm_ops);

-- Stream logs grow forever; add a generic recency index for analytics
-- queries. Existing index is per-token, this one is global.
CREATE INDEX IF NOT EXISTS idx_stream_logs_accessed_at
  ON public.stream_access_logs(accessed_at DESC);

-- ---------------------------------------------------------------
-- 3. Atomic add_track_to_playlist
--    Replaces 5 sequential round trips with 1 RPC call.
--    Returns the new position. Throws on ownership / duplicate errors.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_track_to_playlist(
  p_playlist_id UUID,
  p_track_id    BIGINT
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id UUID;
  v_pos      INTEGER;
BEGIN
  -- Ownership check (also acts as existence check)
  SELECT user_id INTO v_owner_id
    FROM public.playlists
   WHERE id = p_playlist_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  -- Atomic next-position calculation.
  -- COALESCE handles the empty-playlist case.
  SELECT COALESCE(MAX(position), -1) + 1 INTO v_pos
    FROM public.playlist_tracks
   WHERE playlist_id = p_playlist_id;

  -- Insert. UNIQUE(playlist_id, track_id) protects against duplicates;
  -- the trigger will increment track_count automatically.
  INSERT INTO public.playlist_tracks (playlist_id, track_id, position)
       VALUES (p_playlist_id, p_track_id, v_pos);

  RETURN v_pos;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'duplicate';
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_track_to_playlist(UUID, BIGINT)
  TO authenticated;

-- ---------------------------------------------------------------
-- 4. Optional: drop the unused english-only tsvector index now that
--    we have a multi-lingual trigram index. Comment this out if you
--    want to keep both.
-- ---------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_tracks_title;

-- ---------------------------------------------------------------
-- 5. ANALYZE so the planner picks up the new indexes/columns
-- ---------------------------------------------------------------
ANALYZE public.playlists;
ANALYZE public.playlist_tracks;
ANALYZE public.tracks;
