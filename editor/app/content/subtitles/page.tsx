'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

interface Subtitle {
  id: string
  title: string
  storyboard_id: string | null
  entries: Array<{ index: number; start: string; end: string; text: string }>
  created_at: string
  updated_at: string
}

export default function SubtitleListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Subtitle[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/content/subtitles')
      const d = await r.json()
      setItems(d.subtitles || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('이 자막을 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/content/subtitles/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((s) => s.id !== id))
    } catch { /* ignore */ }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <span className="top-bar-title">💬 자막 관리</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="empty">자막이 없습니다. 콘티에서 자막을 생성해보세요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((sub) => (
              <div
                key={sub.id}
                onClick={() => router.push(editorRoute(`/content/subtitles/${sub.id}`))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#444')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#222')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#fafafa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sub.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                    {(sub.entries || []).length}개 항목 · {formatDate(sub.updated_at)}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={(e) => { e.stopPropagation(); handleDelete(sub.id) }}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
