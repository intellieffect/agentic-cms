'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

interface SubEntry {
  index: number
  start: string
  end: string
  text: string
}

interface Subtitle {
  id: string
  title: string
  storyboard_id: string | null
  entries: SubEntry[]
  created_at: string
  updated_at: string
}

export default function SubtitleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [sub, setSub] = useState<Subtitle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showApplyModal, setShowApplyModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/content/subtitles/${id}`)
      if (!r.ok) { router.push(editorRoute('/content/subtitles')); return }
      const d = await r.json()
      setSub(d)
    } catch { router.push(editorRoute('/content/subtitles')) }
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!sub) return
    setSaving(true)
    try {
      await fetch(`/api/content/subtitles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: sub.title, entries: sub.entries }),
      })
    } catch { alert('저장 실패') }
    setSaving(false)
  }

  const updateEntry = (idx: number, patch: Partial<SubEntry>) => {
    if (!sub) return
    const entries = sub.entries.map((e, i) => i === idx ? { ...e, ...patch } : e)
    setSub({ ...sub, entries })
  }

  const addEntry = () => {
    if (!sub) return
    const lastEnd = sub.entries.length > 0 ? sub.entries[sub.entries.length - 1].end : '00:00:00,000'
    const newEntry: SubEntry = {
      index: sub.entries.length + 1,
      start: lastEnd,
      end: lastEnd,
      text: '',
    }
    setSub({ ...sub, entries: [...sub.entries, newEntry] })
  }

  const removeEntry = (idx: number) => {
    if (!sub) return
    const entries = sub.entries.filter((_, i) => i !== idx).map((e, i) => ({ ...e, index: i + 1 }))
    setSub({ ...sub, entries })
  }

  const handleDownloadSrt = () => {
    window.open(`/api/content/subtitles/${id}/srt`, '_blank')
  }

  const handleApply = async () => {
    try {
      const r = await fetch(`/api/content/subtitles/${id}/apply-to-project`, { method: 'POST' })
      const d = await r.json()
      alert(d.message || '적용 완료')
      setShowApplyModal(false)
    } catch { alert('적용 실패') }
  }

  if (loading) return <div className="loading">불러오는 중...</div>
  if (!sub) return <div className="empty">자막을 찾을 수 없습니다.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div className="top-bar">
        <button className="btn" onClick={() => router.push(editorRoute('/content/subtitles'))} style={{ fontSize: 10 }}>← 목록</button>
        <input
          value={sub.title}
          onChange={(e) => setSub({ ...sub, title: e.target.value })}
          style={{
            background: 'transparent', border: 'none', color: '#fafafa',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', width: 200,
          }}
        />
        <div className="top-bar-right">
          <button className="btn" onClick={handleDownloadSrt} style={{ fontSize: 10 }}>📥 SRT 다운로드</button>
          <button className="btn btn-pri" onClick={() => setShowApplyModal(true)} style={{ fontSize: 10 }}>🎬 프로젝트에 적용</button>
          <button className="btn" onClick={save} disabled={saving} style={{ fontSize: 10 }}>
            {saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>
      </div>

      {/* Entries table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888', fontWeight: 500, width: 40 }}>#</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888', fontWeight: 500, width: 140 }}>시작</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888', fontWeight: 500, width: 140 }}>끝</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888', fontWeight: 500 }}>텍스트</th>
              <th style={{ padding: '6px 8px', width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {sub.entries.map((entry, idx) => (
              <tr
                key={idx}
                style={{ borderBottom: '1px solid #1a1a1a' }}
              >
                <td style={{ padding: '4px 8px', color: '#555' }}>{entry.index}</td>
                <td style={{ padding: '4px 8px' }}>
                  <input
                    value={entry.start}
                    onChange={(e) => updateEntry(idx, { start: e.target.value })}
                    style={{
                      background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                      borderRadius: 4, padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', width: 120,
                    }}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input
                    value={entry.end}
                    onChange={(e) => updateEntry(idx, { end: e.target.value })}
                    style={{
                      background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                      borderRadius: 4, padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', width: 120,
                    }}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <input
                    value={entry.text}
                    onChange={(e) => updateEntry(idx, { text: e.target.value })}
                    style={{
                      background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                      borderRadius: 4, padding: '3px 6px', fontSize: 10, fontFamily: 'inherit', width: '100%',
                    }}
                  />
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <button
                    onClick={() => removeEntry(idx)}
                    style={{
                      background: 'none', border: 'none', color: '#f87171',
                      cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
                    }}
                    title="삭제"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="btn" onClick={addEntry} style={{ marginTop: 8, fontSize: 10 }}>+ 항목 추가</button>
      </div>

      {/* Apply modal */}
      {showApplyModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowApplyModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#141414', border: '1px solid #333', borderRadius: 12,
              padding: 24, width: 360,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginBottom: 16 }}>
              영상 프로젝트에 적용
            </div>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
              이 자막을 영상 프로젝트에 적용하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowApplyModal(false)} style={{ fontSize: 10 }}>취소</button>
              <button className="btn btn-pri" onClick={handleApply} style={{ fontSize: 10 }}>적용</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
