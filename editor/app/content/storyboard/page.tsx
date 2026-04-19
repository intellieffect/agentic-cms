'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

interface Storyboard {
  id: string
  title: string
  scenes: Array<{ scene_id: number; duration_sec: number }>
  total_duration_sec: number
  created_at: string
  updated_at: string
}

export default function StoryboardListPage() {
  const router = useRouter()
  const [items, setItems] = useState<Storyboard[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/content/storyboards')
      const d = await r.json()
      setItems(d.storyboards || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const r = await fetch('/api/content/storyboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '새 콘티',
          source_text: '',
          scenes: [],
          format: { width: 1080, height: 1920, fps: 30 },
          bgm: { mood: 'calm', source: null, volume: 60 },
          total_duration_sec: 60,
        }),
      })
      const d = await r.json()
      router.push(editorRoute(`/content/storyboard/${d.id}`))
    } catch {
      alert('생성 실패')
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 콘티를 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/content/storyboards/${id}`, { method: 'DELETE' })
      setItems((prev) => prev.filter((s) => s.id !== id))
    } catch { /* ignore */ }
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return m > 0 ? `${m}분 ${s}초` : `${s}초`
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return iso }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="top-bar">
        <span className="top-bar-title">🎬 콘티 기획</span>
        <div className="top-bar-right">
          <button className="btn btn-pri" onClick={handleCreate} disabled={creating}>
            {creating ? '생성 중...' : '+ 새 콘티'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="empty">콘티가 없습니다. 새 콘티를 만들어보세요.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((sb) => (
              <div
                key={sb.id}
                onClick={() => router.push(editorRoute(`/content/storyboard/${sb.id}`))}
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
                    {sb.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                    {(sb.scenes || []).length}개 씬 · {formatDuration(sb.total_duration_sec || 0)} · {formatDate(sb.updated_at)}
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={(e) => { e.stopPropagation(); handleDelete(sb.id) }}
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
