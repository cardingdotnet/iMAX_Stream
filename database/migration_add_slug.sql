-- =====================================================
-- Migration: Add slug column to playlists
-- =====================================================

-- 1. Add slug column
ALTER TABLE public.playlists 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Create unique index (globally unique slugs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_slug 
ON public.playlists(slug);

-- 3. Backfill existing playlists with slugs
DO $$
DECLARE
    p RECORD;
    base_slug TEXT;
    final_slug TEXT;
    counter INT;
BEGIN
    FOR p IN SELECT id, name FROM public.playlists WHERE slug IS NULL LOOP
        -- Simple slug generation
        base_slug := lower(regexp_replace(p.name, '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g'));
        base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
        IF base_slug = '' THEN
            base_slug := 'playlist';
        END IF;
        
        final_slug := base_slug;
        counter := 2;
        WHILE EXISTS (SELECT 1 FROM public.playlists WHERE slug = final_slug) LOOP
            final_slug := base_slug || '-' || counter;
            counter := counter + 1;
            EXIT WHEN counter > 999;
        END LOOP;
        
        UPDATE public.playlists SET slug = final_slug WHERE id = p.id;
    END LOOP;
END $$;

-- 4. Make slug NOT NULL after backfill
ALTER TABLE public.playlists 
ALTER COLUMN slug SET NOT NULL;

-- =====================================================
-- 5. Drop old function if exists (to allow signature change)
-- =====================================================
DROP FUNCTION IF EXISTS public.get_playlist_by_slug(TEXT);

-- =====================================================
-- 6. Create the lookup function
-- 
-- Note: parameter is named `p_slug` to avoid clash with
-- the `playlist_slug` column in the RETURNS TABLE.
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_playlist_by_slug(p_slug TEXT)
RETURNS TABLE (
    playlist_id UUID,
    playlist_name TEXT,
    playlist_slug TEXT,
    user_id UUID,
    track_id BIGINT,
    track_title TEXT,
    track_artist TEXT,
    track_duration_ms INTEGER,
    track_position INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.slug,
        p.user_id,
        t.id,
        t.title,
        t.artist,
        t.duration_ms,
        pt.position
    FROM public.playlists p
    JOIN public.playlist_tracks pt ON pt.playlist_id = p.id
    JOIN public.tracks t ON t.id = pt.track_id
    WHERE p.slug = p_slug
    ORDER BY pt.position ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
