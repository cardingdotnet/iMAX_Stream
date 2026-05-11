-- =====================================================
-- Spotify Clone Database Schema
-- Platform: Supabase (PostgreSQL)
-- =====================================================

-- Note: Supabase already provides auth.users table
-- We extend it with a profiles table for additional user data

-- =====================================================
-- 1. User Profiles (extends auth.users)
-- =====================================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 30),
    CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- =====================================================
-- 2. Playlists
-- =====================================================
CREATE TABLE public.playlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    is_public BOOLEAN DEFAULT false,
    stream_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    play_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

CREATE INDEX idx_playlists_user_id ON public.playlists(user_id);
CREATE INDEX idx_playlists_stream_token ON public.playlists(stream_token);

-- =====================================================
-- 3. Tracks (cached SoundCloud track metadata)
-- =====================================================
CREATE TABLE public.tracks (
    id BIGINT PRIMARY KEY,  -- SoundCloud track ID
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    artwork_url TEXT,
    permalink_url TEXT,
    soundcloud_user_id BIGINT,
    streamable BOOLEAN DEFAULT true,
    genre TEXT,
    cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracks_artist ON public.tracks(artist);
CREATE INDEX idx_tracks_title ON public.tracks USING gin(to_tsvector('english', title));

-- =====================================================
-- 4. Playlist Tracks (many-to-many with order)
-- =====================================================
CREATE TABLE public.playlist_tracks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE NOT NULL,
    track_id BIGINT REFERENCES public.tracks(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(playlist_id, track_id),
    UNIQUE(playlist_id, position)
);

CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id, position);

-- =====================================================
-- 5. Listen History (analytics)
-- =====================================================
CREATE TABLE public.listen_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id BIGINT REFERENCES public.tracks(id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
    listened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listen_history_user ON public.listen_history(user_id, listened_at DESC);

-- =====================================================
-- 6. Stream Access Logs (for the m3u endpoint)
-- =====================================================
CREATE TABLE public.stream_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_token TEXT NOT NULL,
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_hash TEXT  -- Hashed for privacy
);

CREATE INDEX idx_stream_logs_token ON public.stream_access_logs(stream_token, accessed_at DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_playlists_updated_at
    BEFORE UPDATE ON public.playlists
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Playlists
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public playlists viewable by everyone"
    ON public.playlists FOR SELECT 
    USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create own playlists"
    ON public.playlists FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own playlists"
    ON public.playlists FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own playlists"
    ON public.playlists FOR DELETE 
    USING (auth.uid() = user_id);

-- Tracks (read-only for users, written by service role)
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tracks viewable by everyone"
    ON public.tracks FOR SELECT USING (true);

-- Playlist Tracks
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playlist tracks visible if playlist is accessible"
    ON public.playlist_tracks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.playlists 
            WHERE id = playlist_id 
            AND (is_public = true OR user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage tracks in own playlists"
    ON public.playlist_tracks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.playlists 
            WHERE id = playlist_id AND user_id = auth.uid()
        )
    );

-- Listen History
ALTER TABLE public.listen_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
    ON public.listen_history FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
    ON public.listen_history FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get full playlist with tracks (used by stream endpoint)
CREATE OR REPLACE FUNCTION public.get_playlist_by_stream_token(token TEXT)
RETURNS TABLE (
    playlist_id UUID,
    playlist_name TEXT,
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
        p.user_id,
        t.id,
        t.title,
        t.artist,
        t.duration_ms,
        pt.position
    FROM public.playlists p
    JOIN public.playlist_tracks pt ON pt.playlist_id = p.id
    JOIN public.tracks t ON t.id = pt.track_id
    WHERE p.stream_token = token
    ORDER BY pt.position ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
