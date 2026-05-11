-- =====================================================
-- Migration: Convert slugs to short codes
-- 
-- This makes URLs shorter:
--   Before: /stream/my-summer-vibes-2024
--   After:  /stream/ax8k2m
-- =====================================================

-- Add short_code column (we keep slug too for backward compatibility)
ALTER TABLE public.playlists 
ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_short_code 
ON public.playlists(short_code);

-- Backfill existing playlists with short codes
DO $$
DECLARE
    p RECORD;
    code TEXT;
    chars TEXT := 'abcdefghijkmnpqrstuvwxyz23456789';
    i INT;
BEGIN
    FOR p IN SELECT id FROM public.playlists WHERE short_code IS NULL LOOP
        LOOP
            -- Generate 6-char random code
            code := '';
            FOR i IN 1..6 LOOP
                code := code || substr(chars, floor(random() * length(chars))::int + 1, 1);
            END LOOP;
            
            -- Check if unique
            IF NOT EXISTS (SELECT 1 FROM public.playlists WHERE short_code = code) THEN
                EXIT;
            END IF;
        END LOOP;
        
        UPDATE public.playlists SET short_code = code WHERE id = p.id;
    END LOOP;
END $$;

-- Make NOT NULL after backfill
ALTER TABLE public.playlists 
ALTER COLUMN short_code SET NOT NULL;

-- =====================================================
-- Drop old function and create new lookup function
-- =====================================================
DROP FUNCTION IF EXISTS public.get_playlist_by_slug(TEXT);
DROP FUNCTION IF EXISTS public.get_playlist_by_short_code(TEXT);

-- Lookup by short_code (or slug for backward compatibility)
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
    track_position INTEGER
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
        pt.position
    FROM public.playlists p
    JOIN public.playlist_tracks pt ON pt.playlist_id = p.id
    JOIN public.tracks t ON t.id = pt.track_id
    WHERE p.short_code = p_code OR p.slug = p_code
    ORDER BY pt.position ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
