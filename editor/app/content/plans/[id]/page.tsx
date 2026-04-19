'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

interface Plan {
  id: string
  title: string
  source_url: string
  source_text: string
  type: string
  status: string
  references: {
    videos?: string[]
    finished?: string[]
    carousels?: string[]
  }
  carousel_plan: {
    concept?: string
    target_audience?: string
    hook?: string
    slide_count?: number
    flow?: string[]
    style?: string
  }
  video_plan: {
    concept?: string
    format?: string
    duration_target?: string
    reference_style?: string
    scenes?: string[]
    bgm_mood?: string
    subtitle_style?: string
  }
  created_at: string
  updated_at: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#555', confirmed: '#3b82f6', executed: '#22c55e',
}
const STATUS_LABELS: Record<string, string> = {
  draft: '초안', confirmed: '확정', executed: '실행됨',
}
const TYPE_COLORS: Record<string, string> = {
  carousel: '#ff6b35', video: '#8b5cf6', both: '#f59e0b',
}

const FORMAT_OPTIONS = [
  { value: 'vertical_9_16', label: '세로 9:16' },
  { value: 'square_1_1', label: '정사각 1:1' },
  { value: 'portrait_4_5', label: '세로 4:5' },
]

const BGM_OPTIONS = [
  { value: 'calm', label: 'Calm' },
  { value: 'upbeat', label: 'Upbeat' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'chill', label: 'Chill' },
  { value: 'energetic', label: 'Energetic' },
]

export default function PlanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const planId = params.id as string

  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/plans/${planId}`).catch(() => null)
    if (r && r.ok) {
      const d = await r.json()
      setPlan(d)
    }
    setLoading(false)
  }, [planId])

  useEffect(() => { load() }, [load])

  const update = (patch: Partial<Plan>) => {
    if (!plan) return
    setPlan({ ...plan, ...patch })
  }

  const save = async () => {
    if (!plan) return
    setSaving(true)
    await fetch(`/api/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: plan.title,
        source_url: plan.source_url,
        source_text: plan.source_text,
        type: plan.type,
        references: plan.references,
        carousel_plan: plan.carousel_plan,
        video_plan: plan.video_plan,
      }),
    }).catch(() => null)
    setSaving(false)
  }

  const confirm = async () => {
    await save()
    const r = await fetch(`/api/plans/${planId}/confirm`, { method: 'POST' }).catch(() => null)
    if (r && r.ok) {
      const d = await r.json()
      setPlan((prev) => prev ? { ...prev, status: d.status || 'confirmed' } : prev)
    }
  }

  const deletePlan = async () => {
    if (!window.confirm('이 기획을 삭제하시겠습니까?')) return
    await fetch(`/api/plans/${planId}`, { method: 'DELETE' }).catch(() => null)
    router.push(editorRoute('/content/plans'))
  }

  const handleCreateCarousel = () => { alert('에이전트에게 요청됩니다') }
  const handleCreateVideo = () => { alert('에이전트에게 요청됩니다') }
  const handleReExecute = async () => {
    // confirmed로 되돌리고 다시 execute
    await fetch(`/api/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    }).catch(() => null)
    const r = await fetch(`/api/plans/${planId}/execute`, { method: 'POST' }).catch(() => null)
    if (r && r.ok) {
      const d = await r.json()
      setPlan((prev) => prev ? { ...prev, status: d.status || 'executed' } : prev)
    }
  }

  // Carousel plan helpers
  const cp = plan?.carousel_plan || {}
  const updateCp = (patch: Record<string, unknown>) => {
    update({ carousel_plan: { ...cp, ...patch } })
  }

  // Video plan helpers
  const vp = plan?.video_plan || {}
  const updateVp = (patch: Record<string, unknown>) => {
    update({ video_plan: { ...vp, ...patch } })
  }

  // References helpers
  const refs = plan?.references || {}
  const updateRefs = (patch: Record<string, unknown>) => {
    update({ references: { ...refs, ...patch } })
  }

  if (loading) return <div className="loading">불러오는 중...</div>
  if (!plan) return <div className="empty">기획을 찾을 수 없습니다</div>

  const showCarousel = plan.type === 'carousel' || plan.type === 'both'
  const showVideo = plan.type === 'video' || plan.type === 'both'

  return (
    <>
      {/* top bar */}
      <div className="top-bar">
        <button className="btn" onClick={() => router.push(editorRoute('/content/plans'))}>← 목록</button>
        <div className="sep" />
        <span className="top-bar-title">📋 기획</span>
        <span style={{
          marginLeft: 8, padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 600,
          background: `${STATUS_COLORS[plan.status] || '#555'}22`,
          color: STATUS_COLORS[plan.status] || '#555',
          border: `1px solid ${STATUS_COLORS[plan.status] || '#555'}44`,
        }}>
          {STATUS_LABELS[plan.status] || plan.status}
        </span>
      </div>

      {/* body: 2 column */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', gap: 0 }}>
        {/* 왼쪽 메인 ~65% */}
        <div style={{ flex: '0 0 65%', overflow: 'auto', padding: 20, borderRight: '1px solid #1a1a1a' }}>
          {/* 제목 */}
          <input
            value={plan.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="기획 제목"
            style={{
              width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #222',
              color: '#fafafa', fontSize: 18, fontWeight: 700, padding: '8px 0', marginBottom: 16,
              outline: 'none', fontFamily: 'inherit',
            }}
          />

          {/* source_url + type */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <input
              value={plan.source_url}
              onChange={(e) => update({ source_url: e.target.value })}
              placeholder="소스 URL"
              style={{
                flex: 1, background: '#111', border: '1px solid #222', borderRadius: 6,
                color: '#ccc', fontSize: 11, padding: '6px 10px', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <select
              value={plan.type}
              onChange={(e) => update({ type: e.target.value })}
              style={{
                background: '#111', border: `1px solid ${TYPE_COLORS[plan.type] || '#555'}66`,
                color: TYPE_COLORS[plan.type] || '#ccc', borderRadius: 6,
                fontSize: 11, padding: '6px 10px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <option value="carousel">캐러셀</option>
              <option value="video">영상</option>
              <option value="both">둘다</option>
            </select>
          </div>

          {/* 캐러셀 기획 */}
          {showCarousel && (
            <SectionCard title="🎠 캐러셀 기획">
              <FieldRow label="컨셉">
                <textarea
                  rows={2}
                  value={cp.concept || ''}
                  onChange={(e) => updateCp({ concept: e.target.value })}
                  className="notes-area"
                  style={{ minHeight: 40 }}
                />
              </FieldRow>
              <FieldRow label="타겟 오디언스">
                <FieldInput value={cp.target_audience || ''} onChange={(v) => updateCp({ target_audience: v })} />
              </FieldRow>
              <FieldRow label="훅">
                <FieldInput value={cp.hook || ''} onChange={(v) => updateCp({ hook: v })} />
              </FieldRow>
              <FieldRow label="슬라이드 수">
                <input
                  type="number"
                  value={cp.slide_count || 0}
                  onChange={(e) => updateCp({ slide_count: parseInt(e.target.value) || 0 })}
                  style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4,
                    color: '#ccc', fontSize: 11, padding: '4px 8px', width: 80, outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </FieldRow>
              <FieldRow label="플로우">
                <OrderedList
                  items={cp.flow || []}
                  onChange={(items) => updateCp({ flow: items })}
                  placeholder="슬라이드 내용"
                />
              </FieldRow>
              <FieldRow label="스타일">
                <FieldInput value={cp.style || ''} onChange={(v) => updateCp({ style: v })} />
              </FieldRow>
            </SectionCard>
          )}

          {/* 영상 기획 */}
          {showVideo && (
            <SectionCard title="🎬 영상 기획">
              <FieldRow label="컨셉">
                <textarea
                  rows={2}
                  value={vp.concept || ''}
                  onChange={(e) => updateVp({ concept: e.target.value })}
                  className="notes-area"
                  style={{ minHeight: 40 }}
                />
              </FieldRow>
              <FieldRow label="포맷">
                <select
                  value={vp.format || 'vertical_9_16'}
                  onChange={(e) => updateVp({ format: e.target.value })}
                  className="filter-select"
                >
                  {FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="목표 길이">
                <FieldInput value={vp.duration_target || ''} onChange={(v) => updateVp({ duration_target: v })} placeholder="예: 50~60초" />
              </FieldRow>
              <FieldRow label="레퍼런스 스타일">
                <textarea
                  rows={2}
                  value={vp.reference_style || ''}
                  onChange={(e) => updateVp({ reference_style: e.target.value })}
                  className="notes-area"
                  style={{ minHeight: 40 }}
                />
              </FieldRow>
              <FieldRow label="씬 구성">
                <OrderedList
                  items={vp.scenes || []}
                  onChange={(items) => updateVp({ scenes: items })}
                  placeholder="씬 설명"
                />
              </FieldRow>
              <FieldRow label="BGM 무드">
                <select
                  value={vp.bgm_mood || 'calm'}
                  onChange={(e) => updateVp({ bgm_mood: e.target.value })}
                  className="filter-select"
                >
                  {BGM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="자막 스타일">
                <FieldInput value={vp.subtitle_style || ''} onChange={(v) => updateVp({ subtitle_style: v })} />
              </FieldRow>
            </SectionCard>
          )}
        </div>

        {/* 오른쪽 사이드바 ~35% */}
        <div style={{ flex: '0 0 35%', overflow: 'auto', padding: 20 }}>
          <SectionCard title="📎 참고 레퍼런스">
            <RefList
              label="영상 레퍼런스"
              items={refs.videos || []}
              onChange={(items) => updateRefs({ videos: items })}
              refType="video"
            />
            <RefList
              label="완료 영상"
              items={refs.finished || []}
              onChange={(items) => updateRefs({ finished: items })}
              refType="finished"
            />
            <RefList
              label="캐러셀 레퍼런스"
              items={refs.carousels || []}
              onChange={(items) => updateRefs({ carousels: items })}
              refType="carousel"
            />
          </SectionCard>
        </div>
      </div>

      {/* 하단 고정 바 */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 16px',
        borderTop: '1px solid #222', background: '#0f0f0f', flexShrink: 0, gap: 8,
      }}>
        <button className="btn btn-danger" onClick={deletePlan} style={{ fontSize: 10 }}>삭제</button>
        <div style={{ flex: 1 }} />
        {plan.status === 'draft' && (
          <>
            <button className="btn" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button className="btn btn-pri" onClick={confirm}>확정하기</button>
          </>
        )}
        {plan.status === 'confirmed' && (
          <>
            <button className="btn" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button className="btn" onClick={handleCreateCarousel} style={{ background: '#ff6b35', borderColor: '#ff6b35', color: '#fff' }}>캐러셀 생성</button>
            <button className="btn" onClick={handleCreateVideo} style={{ background: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' }}>영상 프로젝트 생성</button>
          </>
        )}
        {plan.status === 'executed' && (
          <button className="btn btn-pri" onClick={handleReExecute}>재실행</button>
        )}
      </div>
    </>
  )
}

/* ─── Sub-components ─── */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #222', borderRadius: 12,
      padding: 16, marginBottom: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

function FieldInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4,
        color: '#ccc', fontSize: 11, padding: '6px 8px', outline: 'none', fontFamily: 'inherit',
      }}
    />
  )
}

function OrderedList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const add = () => onChange([...items, ''])
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  const set = (idx: number, val: string) => {
    const next = [...items]
    next[idx] = val
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#555', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
          <input
            value={item}
            onChange={(e) => set(i, e.target.value)}
            placeholder={placeholder}
            style={{
              flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4,
              color: '#ccc', fontSize: 11, padding: '4px 8px', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => remove(i)}
            style={{
              background: 'none', border: 'none', color: '#f87171', cursor: 'pointer',
              fontSize: 12, padding: '0 4px', fontFamily: 'inherit',
            }}
          >×</button>
        </div>
      ))}
      <button className="btn" onClick={add} style={{ fontSize: 9, alignSelf: 'flex-start' }}>+ 추가</button>
    </div>
  )
}

interface RefPreview {
  thumb?: string;
  videoUrl?: string;
  title?: string;
  duration?: number;
  slideCount?: number;
  slides?: { media_url: string }[];
}

function RefList({ label, items, onChange, refType }: { label: string; items: string[]; onChange: (v: string[]) => void; refType: 'video' | 'finished' | 'carousel' }) {
  const [input, setInput] = useState('')
  const [previews, setPreviews] = useState<Record<string, RefPreview>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const add = () => {
    if (!input.trim()) return
    onChange([...items, input.trim()])
    setInput('')
  }
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  useEffect(() => {
    items.forEach((id) => {
      if (previews[id]) return
      let url = ''
      if (refType === 'video') url = `/api/references/videos/${id}`
      else if (refType === 'finished') url = `/api/finished/${id}`
      else if (refType === 'carousel') url = `/api/ref-posts/${id}`
      if (!url) return
      fetch(url).then(r => r.json()).then(data => {
        const info: RefPreview = {}
        if (refType === 'video') {
          info.thumb = data.thumbnail_url
          info.videoUrl = data.video_url
          info.title = (data.caption || '').slice(0, 50)
          info.duration = data.duration_sec
        } else if (refType === 'finished') {
          info.thumb = data.thumbnail_path ? `/api/media/thumb?path=${encodeURIComponent(data.thumbnail_path)}` : undefined
          info.videoUrl = data.file_path ? `/api/media/stream?path=${encodeURIComponent(data.file_path)}` : undefined
          info.title = data.name
          info.duration = Math.round(data.duration || 0)
        } else if (refType === 'carousel') {
          info.thumb = data.slides?.[0]?.media_url
          info.title = (data.caption || '').slice(0, 50)
          info.slideCount = data.slide_count || data.slides?.length
          info.slides = (data.slides || []).map((s: { media_url?: string }) => ({ media_url: s.media_url || '' }))
        }
        setPreviews(prev => ({ ...prev, [id]: info }))
      }).catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, refType])

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 9, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      {items.length === 0 && (
        <div style={{ fontSize: 10, color: '#444', marginBottom: 4 }}>없음</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((id, i) => {
          const p = previews[id]
          const isExpanded = expandedId === id
          return (
            <div key={i} style={{ background: '#1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
              {/* 헤더 (클릭으로 확장/축소) */}
              <div
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, cursor: 'pointer' }}
                onClick={() => setExpandedId(isExpanded ? null : id)}
              >
                {p?.thumb ? (
                  <img src={p.thumb} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#222' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 6, background: '#222', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {refType === 'video' ? '🎬' : refType === 'finished' ? '🎞️' : '🎠'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.title || id}</div>
                  <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
                    {p?.duration ? `${p.duration}초` : ''}{p?.slideCount ? `${p.slideCount}장` : ''}{!p?.duration && !p?.slideCount ? id : ''}
                    <span style={{ marginLeft: 6, color: '#555' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); remove(i) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: '0 4px', fontFamily: 'inherit', flexShrink: 0 }}>×</button>
              </div>

              {/* 확장 영역 */}
              {isExpanded && (
                <div style={{ padding: '0 8px 8px' }}>
                  {/* 영상: 비디오 플레이어 */}
                  {(refType === 'video' || refType === 'finished') && p?.videoUrl && (
                    <video
                      src={p.videoUrl}
                      controls
                      style={{ width: '100%', borderRadius: 6, maxHeight: 300, background: '#000' }}
                      preload="metadata"
                    />
                  )}
                  {/* 캐러셀: 슬라이드 가로 스크롤 */}
                  {refType === 'carousel' && p?.slides && p.slides.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                      {p.slides.map((s, si) => (
                        s.media_url ? (
                          <img key={si} src={s.media_url} alt={`slide ${si + 1}`} style={{ height: 120, borderRadius: 4, flexShrink: 0, background: '#222' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : null
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="ID 입력"
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4, color: '#ccc', fontSize: 10, padding: '3px 6px', outline: 'none', fontFamily: 'inherit' }}
        />
        <button className="btn" onClick={add} style={{ fontSize: 9, padding: '2px 6px' }}>+</button>
      </div>
    </div>
  )
}
