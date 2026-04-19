'use client'

import { useState, useEffect } from 'react'

interface RefVideo {
  id: string
  caption?: string
  platform?: string
  style_tags?: string[]
  video_url?: string
  favorite?: boolean
  created_at?: string
}

interface RefCollection {
  id: string
  name: string
}

export default function CarouselReferencePanel() {
  const [tab, setTab] = useState<'favorites' | 'collections' | 'all'>('favorites')
  const [videos, setVideos] = useState<RefVideo[]>([])
  const [collections, setCollections] = useState<RefCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState<RefVideo | null>(null)

  useEffect(() => {
    loadVideos()
    loadCollections()
  }, [])

  const loadVideos = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/references/videos?limit=30&sort=likes')
      const d = await r.json()
      setVideos(d.videos || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  const loadCollections = async () => {
    try {
      const r = await fetch('/api/references/collections')
      const d = await r.json()
      setCollections(d.collections || [])
    } catch { /* ignore */ }
  }

  const filteredVideos = tab === 'favorites'
    ? videos.filter(v => v.favorite)
    : videos

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 4 }}>
        {(['favorites', 'collections', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 500, cursor: 'pointer',
              background: tab === t ? '#FF6B35' : '#111',
              color: tab === t ? '#fff' : '#666',
            }}
          >
            {t === 'favorites' ? '⭐ 즐겨찾기' : t === 'collections' ? '📁 컬렉션' : '🎬 전체'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {tab === 'collections' ? (
          /* Collections list */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {collections.length === 0 ? (
              <div style={{ color: '#555', fontSize: 10, textAlign: 'center', padding: 20 }}>
                컬렉션이 없습니다
              </div>
            ) : collections.map(col => (
              <div
                key={col.id}
                style={{
                  padding: '10px 12px', borderRadius: 6, background: '#111',
                  border: '1px solid #222', fontSize: 11, color: '#ccc', cursor: 'pointer',
                }}
              >
                📁 {col.name}
              </div>
            ))}
          </div>
        ) : (
          /* Video grid */
          loading ? (
            <div style={{ color: '#555', fontSize: 10, textAlign: 'center', padding: 20 }}>불러오는 중...</div>
          ) : filteredVideos.length === 0 ? (
            <div style={{ color: '#555', fontSize: 10, textAlign: 'center', padding: 20 }}>
              {tab === 'favorites' ? '즐겨찾기한 레퍼런스가 없습니다' : '레퍼런스가 없습니다'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
              {filteredVideos.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVideo(selectedVideo?.id === v.id ? null : v)}
                  style={{
                    borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                    border: selectedVideo?.id === v.id ? '2px solid #FF6B35' : '2px solid transparent',
                    background: '#111',
                  }}
                >
                  <div style={{
                    aspectRatio: '9/16', background: '#0a0a0a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {v.favorite ? '⭐' : '🎬'}
                  </div>
                  <div style={{ padding: '4px 6px' }}>
                    <div style={{ fontSize: 8, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.caption?.slice(0, 20) || v.id.slice(0, 8)}
                    </div>
                    {v.style_tags && v.style_tags.length > 0 && (
                      <div style={{ fontSize: 7, color: '#555', marginTop: 2 }}>
                        {v.style_tags.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Selected video detail */}
      {selectedVideo && (
        <div style={{
          borderTop: '1px solid #1a1a1a', padding: 10, flexShrink: 0,
          background: '#0a0a0a',
        }}>
          <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4, fontWeight: 500 }}>
            선택된 레퍼런스
          </div>
          <div style={{ fontSize: 9, color: '#888', marginBottom: 6 }}>
            {selectedVideo.caption?.slice(0, 80) || selectedVideo.id}
          </div>
          {selectedVideo.video_url && (
            <video
              src={selectedVideo.video_url}
              style={{ width: '100%', borderRadius: 6, maxHeight: 200 }}
              controls
              loop
              playsInline
            />
          )}
          {selectedVideo.style_tags && selectedVideo.style_tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {selectedVideo.style_tags.map(t => (
                <span key={t} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 3, background: '#222', color: '#888' }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
