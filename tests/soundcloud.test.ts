import { describe, expect, it } from 'vitest'
import { soundcloudEmbedUrl, soundcloudSearchUrl } from '../src/lib/soundcloud'

describe('soundcloud helpers', () => {
  it('builds a search URL from a title', () => {
    expect(soundcloudSearchUrl('ממעמקים')).toContain('soundcloud.com/search')
    expect(soundcloudSearchUrl('ממעמקים')).toContain(encodeURIComponent('ממעמקים'))
  })

  it('builds an embed URL for a known track URL', () => {
    const url = soundcloudEmbedUrl('https://soundcloud.com/user/track')
    expect(url).toContain('w.soundcloud.com/player')
    expect(url).toContain(encodeURIComponent('https://soundcloud.com/user/track'))
  })
})