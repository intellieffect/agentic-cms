'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'
import { theme } from '@/lib/theme'
import { SlideDeckThumbnail, getThumbnailSize } from '@/components/carousel/SlideDeckThumbnail'
import type { SlideDeckSlide } from '@/components/carousel/slide-deck'

interface CarouselListItem {
  id: string
  title: string
  template?: string
  slides?: SlideDeckSlide[]
  data?: { slides?: SlideDeckSlide[] }
  created_at: string
  updated_at: string
}

function getSlides(c: CarouselListItem): SlideDeckSlide[] {
  if (Array.isArray(c.slides) && c.slides.length > 0) return c.slides
  if (c.data && Array.isArray(c.data.slides) && c.data.slides.length > 0) return c.data.slides
  return []
}

const thumbSize = getThumbnailSize(0.2)

export default function CarouselListPage() {
  const router = useRouter()
  const [carousels, setCarousels] = useState<CarouselListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const handleDownload = async (id: string, title: string) => {
    setDownloadingId(id)
    try {
      const response = await fetch(`/api/carousels/${id}/render`, { method: 'POST' })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title || 'carousel'}_slides.zip`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('다운로드 실패: ' + (e instanceof Error ? e.message : e))
    } finally {
      setDownloadingId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/carousels')
      const d = await r.json()
      setCarousels(d.carousels || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const r = await fetch('/api/carousels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '새 캐러셀',
          template: 'SlideDeck',
          data: { slides: [] },
          style_config: {},
        }),
      })
      const d = await r.json()
      if (d.id) {
        router.push(editorRoute(`/carousel/${d.id}`))
      }
    } catch (e) {
      alert('생성 실패: ' + (e instanceof Error ? e.message : e))
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 캐러셀을 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/carousels/${id}`, { method: 'DELETE' })
      setCarousels((prev) => prev.filter((c) => c.id !== id))
    } catch { /* ignore */ }
  }

  const formatDate = (v: string) => {
    try {
      const d = new Date(v)
      return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    } catch { return '-' }
  }

  return (
    <>
      {/* Top bar */}
      <div className="top-bar">
        <span className="top-bar-title">캐러셀</span>
        <div className="sep" />
        <div className="top-bar-right">
          <span style={{ fontSize: 12, color: theme.textDim }}>
            {carousels.length}개 프로젝트
          </span>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              marginLeft: 12,
              padding: '6px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#ff6b35',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: creating ? 'wait' : 'pointer',
            }}
          >
            {creating ? '생성 중...' : '+ 새 캐러셀'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ color: theme.textDim, fontSize: 13, textAlign: 'center', padding: 60 }}>
            불러오는 중...
          </div>
        ) : carousels.length === 0 ? (
          <div style={{ color: theme.textDim, fontSize: 13, textAlign: 'center', padding: 60 }}>
            아직 캐러셀이 없습니다. 새 캐러셀을 만들어 시작하세요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {carousels.map((c) => {
              const slides = getSlides(c)
              const templateIds = slides
                .map((s) => s.templateId)
                .filter((v, i, a) => a.indexOf(v) === i)

              return (
                <div
                  key={c.id}
                  onClick={() => router.push(editorRoute(`/carousel/${c.id}`))}
                  style={{
                    background: theme.bg,
                    borderRadius: 16,
                    border: `1px solid ${theme.borderLight}`,
                    cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.border
                    e.currentTarget.style.background = theme.bgCard
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.borderLight
                    e.currentTarget.style.background = theme.bg
                  }}
                >
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px 10px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: '#fafafa',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {c.title || '제목 없음'}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 4,
                        fontSize: 11,
                        color: theme.textDim,
                      }}>
                        <span>{slides.length}장</span>
                        {templateIds.length > 0 && (
                          <>
                            <span style={{ color: '#444' }}>·</span>
                            <span>{templateIds.join(', ')}</span>
                          </>
                        )}
                        <span style={{ color: '#444' }}>·</span>
                        <span>{formatDate(c.updated_at || c.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(c.id, c.title)
                        }}
                        disabled={downloadingId === c.id}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          color: downloadingId === c.id ? '#ff6b35' : '#444',
                          fontSize: 11,
                          cursor: downloadingId === c.id ? 'wait' : 'pointer',
                          transition: 'color .15s, background .15s',
                        }}
                        onMouseEnter={(e) => {
                          if (downloadingId !== c.id) {
                            e.currentTarget.style.color = '#ff6b35'
                            e.currentTarget.style.background = '#1a1a1a'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (downloadingId !== c.id) {
                            e.currentTarget.style.color = '#444'
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        {downloadingId === c.id ? (
                          <span>⏳ 다운로드 중...</span>
                        ) : (
                          '다운로드'
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(c.id)
                        }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'transparent',
                          color: '#444',
                          fontSize: 11,
                          cursor: 'pointer',
                          transition: 'color .15s, background .15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#f87171'
                          e.currentTarget.style.background = '#1a1a1a'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#444'
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* Slide thumbnail strip */}
                  <div style={{ padding: '0 20px 16px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {slides.length > 0 ? (
                        slides.map((slide, idx) => (
                          <div
                            key={slide.id ?? `slide-${idx}`}
                            style={{
                              flexShrink: 0,
                              width: thumbSize.width,
                              height: thumbSize.height,
                              borderRadius: 8,
                              border: '1px solid #1a1a1a',
                              overflow: 'hidden',
                              background: '#0a0a0a',
                            }}
                          >
                            <SlideDeckThumbnail
                              slide={slide}
                              slideIndex={idx}
                              totalSlides={slides.length}
                              scale={0.2}
                            />
                          </div>
                        ))
                      ) : (
                        <div style={{
                          fontSize: 12,
                          color: '#444',
                          padding: '20px 0',
                        }}>
                          슬라이드 없음
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
