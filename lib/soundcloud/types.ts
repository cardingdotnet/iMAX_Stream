/**
 * SoundCloud API Types
 * Reference: https://developers.soundcloud.com/docs/api/reference
 */

export interface SoundCloudUser {
  id: number;
  username: string;
  permalink: string;
  permalink_url: string;
  avatar_url: string;
  full_name?: string;
  city?: string;
  country?: string;
  followers_count: number;
}

export interface SoundCloudTrack {
  id: number;
  title: string;
  description: string | null;
  duration: number; // milliseconds
  genre: string | null;
  permalink_url: string;
  artwork_url: string | null;
  streamable: boolean;
  stream_url: string | null;
  download_url: string | null;
  playback_count: number;
  likes_count: number;
  user: SoundCloudUser;
  created_at: string;
  tag_list: string;
  bpm: number | null;
}

export interface SoundCloudPlaylist {
  id: number;
  title: string;
  description: string | null;
  permalink_url: string;
  artwork_url: string | null;
  track_count: number;
  duration: number;
  user: SoundCloudUser;
  tracks: SoundCloudTrack[];
}

export interface SearchResult {
  collection: SoundCloudTrack[];
  next_href?: string;
  total_results?: number;
}

/**
 * Normalized track shape used throughout our app
 * (Independent of SoundCloud's API to allow source switching later)
 */
export interface Track {
  id: number;
  title: string;
  artist: string;
  artistId: number;
  duration: number; // milliseconds
  artworkUrl: string | null;
  permalinkUrl: string;
  streamable: boolean;
  genre: string | null;
  source: 'soundcloud';
}

/**
 * Convert SoundCloud track to our normalized Track shape
 */
export function normalizeTrack(scTrack: SoundCloudTrack): Track {
  // SoundCloud provides small artwork by default; upgrade to high-res
  const artworkUrl = scTrack.artwork_url
    ? scTrack.artwork_url.replace('-large', '-t500x500')
    : scTrack.user.avatar_url?.replace('-large', '-t500x500') || null;

  return {
    id: scTrack.id,
    title: scTrack.title,
    artist: scTrack.user.username,
    artistId: scTrack.user.id,
    duration: scTrack.duration,
    artworkUrl,
    permalinkUrl: scTrack.permalink_url,
    streamable: scTrack.streamable,
    genre: scTrack.genre,
    source: 'soundcloud',
  };
}
