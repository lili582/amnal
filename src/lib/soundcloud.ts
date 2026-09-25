// SoundCloud deep links used by the end-of-round reveal card. Building the
// search URL is safe (no fake track ids); a real embed URL must come from
// data/famous-songs.json only.
export function soundcloudSearchUrl(title: string): string {
  return `https://soundcloud.com/search?q=${encodeURIComponent(title)}`
}

// A SoundCloud track URL can be embedded via the official widget by URL.
export function soundcloudEmbedUrl(trackUrl: string): string {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(trackUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false`
}