'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

interface Plan {
  id: string
  title: string
  type: string
  status: string
  source_url: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: '초안',
  confirmed: '확정',
  executed: '실행됨',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#555',
  confirmed: '#3b82f6',
  executed: '#22c55e',
}

const TYPE_LABELS: Record<string, string> = {
  carousel: '캐러셀',
  video: '영상',
  both: '둘다',
}

const TYPE_COLORS: Record<string, string> = {
  carousel: '#ff6b35',
  video: '#8b5cf6',
  both: '#f59e0b',
}

export default function PlansPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const qs = filter ? `?status=${filter}` : ''
    const r = await fetch(`/api/plans${qs}`).catch(() => null)
    if (r && r.ok) {
      const d = await r.json()
      setPlans(d.plans || [])
      setTotal(d.total || 0)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const formatDate = (v: string) => {
    const d = new Date(v)
    if (isNaN(d.getTime())) return '-'
    const diff = Date.now() - d.getTime()
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const tabs = [
    { key: '', label: '전체' },
    { key: 'draft', label: '초안' },
    { key: 'confirmed', label: '확정' },
    { key: 'executed', label: '실행됨' },
  ]

  return (
    <>
      <div className="top-bar">
        <span className="top-bar-title">📋 기획</span>
        <div className="sep" />
        <span style={{ fontSize: 11, color: '#555' }}>
          {total}개 기획
        </span>
      </div>

      {/* 필터 탭 */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 12px',
        borderBottom: '1px solid #1a1a1a', flexShrink: 0,
      }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`btn${filter === t.key ? ' btn-on' : ''}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : plans.length === 0 ? (
          <div className="empty">
            에이전트에게 블로그 글을 전달하면 기획이 자동 생성됩니다
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 800, margin: '0 auto' }}>
            {plans.map((p) => (
              <div
                key={p.id}
                onClick={() => router.push(editorRoute(`/content/plans/${p.id}`))}
                style={{
                  background: '#111', border: '1px solid #222', borderRadius: 12,
                  padding: 18, cursor: 'pointer', transition: '.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#eee' }}>
                    {p.title || '제목 없음'}
                  </span>
                  {/* type 뱃지 */}
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                    background: `${TYPE_COLORS[p.type] || '#555'}22`,
                    color: TYPE_COLORS[p.type] || '#555',
                    border: `1px solid ${TYPE_COLORS[p.type] || '#555'}44`,
                  }}>
                    {TYPE_LABELS[p.type] || p.type}
                  </span>
                  {/* status 뱃지 */}
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                    background: `${STATUS_COLORS[p.status] || '#555'}22`,
                    color: STATUS_COLORS[p.status] || '#555',
                    border: `1px solid ${STATUS_COLORS[p.status] || '#555'}44`,
                  }}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.source_url && (
                    <span
                      style={{ fontSize: 10, color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}
                      onClick={(e) => { e.stopPropagation(); window.open(p.source_url, '_blank') }}
                    >
                      {p.source_url}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#555', flexShrink: 0 }}>
                    {formatDate(p.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
