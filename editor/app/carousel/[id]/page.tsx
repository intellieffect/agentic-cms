'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'
import { SLIDE_TEMPLATES } from '@/lib/studio/slide-templates'
import { canvas, spacing } from '@/lib/studio/slide-tokens'
import { PropControl } from '@/components/slide-editor/PropControl'
import { SlideDeckThumbnail } from '@/components/carousel/SlideDeckThumbnail'
import {
  buildSlideFromProps,
  defaultLabelForCategory,
  defaultSlides,
  getTemplateName,
  makeSlide,
  resolveSlideProps,
  type SlideCategory,
  type SlideDeckProject,
  type SlideDeckSlide,
} from '@/components/carousel/slide-deck'
import { renderSlideToPng, downloadSlidesAsZip } from '@/components/carousel/export-png'

interface GenerateSource {
  text: string
  title?: string
  preferredTemplate?: string
  referencePostId?: string
}

function normalizeDetailProject(data: Partial<SlideDeckProject> | null | undefined): SlideDeckProject | null {
  if (!data || !data.id) return null
  const slides = Array.isArray(data.slides) && data.slides.length > 0 ? data.slides : defaultSlides(data.title || '새 캐러셀')
  return {
    id: data.id,
    title: data.title || '새 캐러셀',
    caption: data.caption || '',
    slides,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

function firstTemplateForCategory(category: SlideCategory) {
  return SLIDE_TEMPLATES.find((template) => template.category === category) || SLIDE_TEMPLATES[0]
}

export default function CarouselDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [carousel, setCarousel] = useState<SlideDeckProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [editableProps, setEditableProps] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content')
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generateStatus, setGenerateStatus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [serverRendering, setServerRendering] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [showIGPreview, setShowIGPreview] = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const [captionDraft, setCaptionDraft] = useState('')
  const [captionDirty, setCaptionDirty] = useState(false)
  const [captionSaving, setCaptionSaving] = useState(false)

  useEffect(() => {
    if (id === 'new') {
      setCarousel({
        id: 'new',
        title: '새 캐러셀',
        caption: '',
        slides: defaultSlides('새 캐러셀'),
      })
      setLoading(false)
      return
    }

    fetch(`/api/carousels/${id}`)
      .then((response) => response.json())
      .then((data) => {
        const project = normalizeDetailProject(data)
        setCarousel(project)
        setCaptionDraft(project?.caption || '')
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!carousel) return
    if (!Array.isArray(carousel.slides) || carousel.slides.length === 0) {
      setCarousel((prev) => (prev ? { ...prev, slides: defaultSlides(prev.title || '새 캐러셀') } : prev))
      setSelectedSlide(0)
      return
    }
    if (selectedSlide >= carousel.slides.length) {
      setSelectedSlide(Math.max(0, carousel.slides.length - 1))
    }
  }, [carousel, selectedSlide])

  const slide = carousel?.slides[selectedSlide]
  const activeTemplate = SLIDE_TEMPLATES.find((template) => template.id === (previewTemplateId || slide?.templateId || ''))
  const PreviewComponent = activeTemplate?.component

  useEffect(() => {
    if (!carousel || !slide) return
    setEditableProps(resolveSlideProps(slide, selectedSlide, carousel.slides.length))
    setDirty(false)
    setActiveTab('content')
    setPreviewTemplateId(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carousel?.updated_at, selectedSlide, slide?.templateId])

  const contentEntries = useMemo(() => {
    if (!activeTemplate) return []
    return Object.entries(activeTemplate.propsSchema).filter(([, schema]) => (schema.group ?? 'content') === 'content')
  }, [activeTemplate])

  const styleEntries = useMemo(() => {
    if (!activeTemplate) return []
    return Object.entries(activeTemplate.propsSchema).filter(([, schema]) => schema.group === 'style')
  }, [activeTemplate])

  const previewSlide = useMemo(() => {
    if (!slide) return null
    return previewTemplateId ? { ...slide, templateId: previewTemplateId } : slide
  }, [previewTemplateId, slide])

  const previewProps = useMemo(() => {
    if (!previewSlide || !carousel) return {}
    const raw = previewTemplateId
      ? resolveSlideProps(previewSlide, selectedSlide, carousel.slides.length)
      : editableProps

    // 프리뷰 전용 처리 (저장에는 영향 없음)
    if (!activeTemplate) return raw
    const filled: Record<string, unknown> = { ...raw }
    for (const [key, schema] of Object.entries(activeTemplate.propsSchema)) {
      if ((schema.group ?? 'content') !== 'content') continue
      const val = filled[key]
      // null = "사용안함" → 프리뷰에서 해당 필드 숨김
      if (val === null) {
        const type = schema.type || ''
        if (type.includes('[]')) {
          filled[key] = []
        } else if (type === 'boolean') {
          filled[key] = false
        } else {
          // 빈 문자열 → falsy이므로 {value && <렌더>} 패턴에서 자동 숨김
          filled[key] = ''
        }
        continue
      }
      const type = schema.type || ''
      if (type.includes('[]')) continue
      if (val === '' || val === undefined) {
        filled[key] = `여기에 ${schema.label}을(를) 입력하세요`
      }
    }
    return filled
  }, [previewSlide, carousel, previewTemplateId, editableProps, selectedSlide, activeTemplate])

  const saveCarousel = useCallback(
    async (next: Partial<Pick<SlideDeckProject, 'title' | 'caption' | 'slides'>>) => {
      if (!carousel) return null
      setSaving(true)
      try {
        const creating = carousel.id === 'new'
        const response = await fetch(creating ? '/api/carousels' : `/api/carousels/${carousel.id}`, {
          method: creating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: next.title ?? carousel.title,
            caption: next.caption ?? carousel.caption ?? '',
            slides: next.slides ?? carousel.slides,
            width: canvas.width,
            height: canvas.height,
          }),
        })
        const updated = await response.json()
        if (!response.ok) throw new Error(updated.error || String(response.status))
        setCarousel(normalizeDetailProject(updated))
        if (creating && updated?.id) {
          window.history.replaceState({}, '', `/carousel/${updated.id}`)
        }
        return normalizeDetailProject(updated) as SlideDeckProject
      } finally {
        setSaving(false)
      }
    },
    [carousel]
  )

  const handleSaveSlide = useCallback(async () => {
    if (!carousel || !slide) return
    const nextSlides = carousel.slides.map((item, index) =>
      index === selectedSlide ? buildSlideFromProps(item, editableProps) : item
    )
    const updated = await saveCarousel({ slides: nextSlides })
    if (updated) {
      setDirty(false)
    }
  }, [carousel, slide, selectedSlide, editableProps, saveCarousel])

  const handleTitleSave = async (value: string) => {
    if (!carousel || value === carousel.title) return
    await saveCarousel({ title: value })
  }

  const handleCaptionSave = async (value: string) => {
    if (!carousel || value === (carousel.caption || '')) return
    await saveCarousel({ caption: value })
  }

  const handleApplyTemplate = async (templateId: string) => {
    if (!carousel || !slide) return
    // 현재 편집 중인 props에서 새 템플릿 schema에 매핑 가능한 값을 content로 이관
    const newTemplate = SLIDE_TEMPLATES.find((t) => t.id === templateId)
    const currentProps = editableProps

    // 새 템플릿의 content 필드에 기존 값을 최대한 매핑
    const newContent: Record<string, unknown> = { ...(slide.content || {}) }
    const newOverrides: Record<string, unknown> = {}

    if (newTemplate) {
      for (const [key, schema] of Object.entries(newTemplate.propsSchema)) {
        // content 그룹의 필드
        if ((schema.group ?? 'content') === 'content') {
          if (currentProps[key] !== undefined && currentProps[key] !== null) {
            newContent[key] = currentProps[key]
          }
          // 매핑 안 된 필드는 빈 값으로 (기본 데이터 대신 placeholder 유도)
          if (newContent[key] === undefined) {
            const type = schema.type || ''
            if (type.includes('[]')) {
              newContent[key] = []
            } else {
              newContent[key] = ''
            }
          }
        } else if (schema.group === 'style') {
          const existingVal = slide.overrides?.[key] ?? currentProps[key]
          if (existingVal !== undefined && existingVal !== null && existingVal !== schema.default) {
            newOverrides[key] = existingVal
          }
        }
      }
    }

    const nextSlides = carousel.slides.map((item, index) =>
      index === selectedSlide
        ? {
            ...item,
            templateId,
            label: item.label || getTemplateName(templateId),
            content: newContent,
            overrides: newOverrides,
          }
        : item
    )
    await saveCarousel({ slides: nextSlides })
  }

  const handleAddSlide = async (category: SlideCategory) => {
    if (!carousel) return
    const template = firstTemplateForCategory(category)
    const nextSlide = makeSlide({
      templateId: template.id,
      category,
      label: defaultLabelForCategory(category),
      content: {},
    })
    const nextSlides = [...carousel.slides]
    nextSlides.splice(selectedSlide + 1, 0, nextSlide)
    const updated = await saveCarousel({ slides: nextSlides })
    if (updated) {
      setSelectedSlide(Math.min(selectedSlide + 1, updated.slides.length - 1))
    }
  }

  const handleDeleteSlide = async () => {
    if (!carousel || carousel.slides.length <= 1) return
    const nextSlides = carousel.slides.filter((_, index) => index !== selectedSlide)
    const updated = await saveCarousel({ slides: nextSlides })
    if (updated) {
      setSelectedSlide(Math.max(0, Math.min(selectedSlide, updated.slides.length - 1)))
    }
  }

  const handleGenerate = useCallback(
    async (source?: GenerateSource) => {
      const prompt = (source?.text || generatePrompt).trim()
      if (!prompt) {
        setGenerateStatus('생성할 텍스트를 입력하세요')
        return
      }
      setGenerating(true)
      setGenerateStatus('자동 생성 중...')
      try {
        const response = await fetch('/api/carousels/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            title: source?.title || carousel?.title || '새 캐러셀',
            preferred_template: source?.preferredTemplate,
            reference_post_id: source?.referencePostId,
            max_slides: 8,
          }),
        })
        const generated = await response.json()
        if (!response.ok) throw new Error(generated.error || String(response.status))
        const slides = Array.isArray(generated.slides) ? generated.slides : defaultSlides(generated.title || '새 캐러셀')
        const payload = {
          title: generated.title || carousel?.title || '새 캐러셀',
          caption: generated.caption || carousel?.caption || '',
          slides,
        }

        if (!carousel || carousel.id === 'new') {
          const createResponse = await fetch('/api/carousels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const created = await createResponse.json()
          if (!createResponse.ok) throw new Error(created.error || String(createResponse.status))
          window.location.href = editorRoute(`/carousel/${created.id}`)
          return
        }

        const updated = await saveCarousel(payload)
        if (updated) {
          setSelectedSlide(0)
          setGenerateStatus(`완료: ${updated.slides.length}장 생성`)
          if (!source) setGeneratePrompt('')
        }
      } catch (error) {
        setGenerateStatus(`실패: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setGenerating(false)
      }
    },
    [generatePrompt, carousel, saveCarousel]
  )

  const handleExport = useCallback(async () => {
    if (!carousel) return
    setExportStatus(`렌더링 중... (0/${carousel.slides.length})`)
    const originalIndex = selectedSlide
    const dataUrls: string[] = []
    try {
      for (let index = 0; index < carousel.slides.length; index += 1) {
        setSelectedSlide(index)
        await new Promise((resolve) => setTimeout(resolve, 180))
        const previewEl = document.getElementById('carousel-preview')
        if (!previewEl) throw new Error('프리뷰 엘리먼트를 찾지 못했습니다')
        dataUrls.push(await renderSlideToPng(previewEl, { width: canvas.width, height: canvas.height }))
        setExportStatus(`렌더링 중... (${index + 1}/${carousel.slides.length})`)
      }
      await downloadSlidesAsZip(dataUrls, carousel.title || 'carousel')
      setExportStatus('내보내기 완료')
      setTimeout(() => setExportStatus(''), 3000)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : (error instanceof Event ? 'CORS 또는 이미지 로딩 실패 — 서버 PNG ZIP을 사용해주세요' : String(error))
      setExportStatus(`실패: ${errMsg}`)
    } finally {
      setSelectedSlide(originalIndex)
    }
  }, [carousel, selectedSlide])

  const handleServerRender = useCallback(async (format: 'png' | 'pdf') => {
    if (!carousel || carousel.id === 'new') {
      setExportStatus('먼저 프로젝트를 저장해주세요')
      setTimeout(() => setExportStatus(''), 3000)
      return
    }
    setServerRendering(true)
    setExportStatus(`서버 렌더링 중 (${format.toUpperCase()})...`)
    try {
      const endpoint = format === 'pdf'
        ? `/api/carousels/${carousel.id}/render/pdf`
        : `/api/carousels/${carousel.id}/render`
      const response = await fetch(endpoint, { method: 'POST' })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = format === 'pdf'
        ? `${carousel.title || 'carousel'}.pdf`
        : `${carousel.title || 'carousel'}_slides.zip`
      link.click()
      URL.revokeObjectURL(url)
      setExportStatus(`${format.toUpperCase()} 다운로드 완료`)
      setTimeout(() => setExportStatus(''), 3000)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : (error instanceof Event ? '네트워크 에러 — 서버 연결을 확인해주세요' : String(error))
      setExportStatus(`서버 렌더 실패: ${errMsg}`)
    } finally {
      setServerRendering(false)
    }
  }, [carousel])

  if (loading) {
    return <p style={{ padding: 32, color: '#666' }}>로딩 중...</p>
  }

  if (!carousel || !slide || !PreviewComponent || !activeTemplate) {
    return <p style={{ padding: 32, color: '#666' }}>캐러셀을 찾을 수 없습니다.</p>
  }

  const relatedTemplates = SLIDE_TEMPLATES.filter((template) => template.category === slide.category)
  const hasStyleProps = styleEntries.length > 0
  const igScale = 468 / canvas.width

  const navigateSlide = (delta: number) => {
    const next = selectedSlide + delta
    if (next >= 0 && next < carousel.slides.length) {
      setSelectedSlide(next)
      setPreviewTemplateId(null)
    }
  }

  const handleCaptionSaveExplicit = async () => {
    if (!carousel || captionDraft === (carousel.caption || '')) return
    setCaptionSaving(true)
    try {
      await saveCarousel({ caption: captionDraft })
      setCaptionDirty(false)
    } finally {
      setCaptionSaving(false)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link href={editorRoute('/carousel')} style={{ fontSize: 14, color: '#555', textDecoration: 'none' }}>
          ← 목록
        </Link>
        <input
          value={carousel.title}
          onChange={(event) => setCarousel({ ...carousel, title: event.target.value })}
          onBlur={(event) => handleTitleSave(event.target.value)}
          style={{ minWidth: 0, flex: 1, border: 'none', background: 'transparent', fontSize: 20, fontWeight: 700, color: '#fafafa', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: '#555' }}>{carousel.slides.length}장</span>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
        {/* ─── 미리보기 영역 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {showIGPreview ? (
            /* ── Instagram 피드 미리보기 ── */
            <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', width: 468 }}>
              {/* IG Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #f58529, #dd2a7b, #8134af)', padding: 2 }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>B</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>brxce.ai</div>
                </div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6" r="1.5" fill="#a8a8a8"/><circle cx="12" cy="12" r="1.5" fill="#a8a8a8"/><circle cx="12" cy="18" r="1.5" fill="#a8a8a8"/></svg>
              </div>

              {/* 슬라이드 이미지 */}
              <div style={{ position: 'relative', width: 468, height: 585 }}>
                <div
                  id="carousel-preview"
                  style={{
                    transform: `scale(${igScale})`,
                    transformOrigin: 'top left',
                    width: canvas.width,
                    height: canvas.height,
                  }}
                >
                  <PreviewComponent {...previewProps} />
                </div>
                {/* 캐러셀 인디케이터 */}
                {carousel.slides.length > 1 && (
                  <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                    {carousel.slides.map((_: SlideDeckSlide, idx: number) => (
                      <div key={idx} style={{ width: 6, height: 6, borderRadius: '50%', background: idx === selectedSlide ? '#0095f6' : 'rgba(255,255,255,0.4)', transition: 'background .15s' }} />
                    ))}
                  </div>
                )}
                {/* 좌우 넘기기 */}
                {selectedSlide > 0 && (
                  <button
                    onClick={() => navigateSlide(-1)}
                    style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, cursor: 'pointer', border: 'none' }}
                  >&#8249;</button>
                )}
                {selectedSlide < carousel.slides.length - 1 && (
                  <button
                    onClick={() => navigateSlide(1)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, cursor: 'pointer', border: 'none' }}
                  >&#8250;</button>
                )}
                {/* 슬라이드 번호 */}
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(26,26,26,0.8)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 9999 }}>
                  {selectedSlide + 1}/{carousel.slides.length}
                </div>
              </div>

              {/* Action bar */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 16 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                <div style={{ flex: 1 }} />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </div>

              {/* Likes */}
              <div style={{ padding: '0 14px 4px' }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>좋아요 128개</div>
              </div>

              {/* Caption with "더 보기" */}
              <div style={{ padding: '0 14px 12px' }}>
                {captionDraft ? (
                  <div style={{ fontSize: 13, color: '#fff' }}>
                    <span style={{ fontWeight: 600 }}>brxce.ai</span>{' '}
                    {(() => {
                      const plain = captionDraft.replace(/\*\*([^*]+)\*\*/g, '$1')
                      return captionExpanded ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{plain}</span>
                      ) : (
                        <>
                          <span>{plain.length > 80 ? plain.slice(0, 80) + '...' : plain}</span>
                          {plain.length > 80 && (
                            <button onClick={() => setCaptionExpanded(true)} style={{ color: '#a8a8a8', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>더 보기</button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#a8a8a8', fontStyle: 'italic' }}>캡션을 입력해주세요</span>
                )}
              </div>
            </div>
          ) : (
            /* ── 기본 미리보기 (50% scale) ── */
            <div
              style={{ position: 'relative', border: '1px solid #222', borderRadius: 12, overflow: 'hidden', width: canvas.width * 0.5, height: canvas.height * 0.5 }}
            >
              <div
                id="carousel-preview"
                style={{
                  transform: 'scale(0.5)',
                  transformOrigin: 'top left',
                  width: canvas.width,
                  height: canvas.height,
                }}
              >
                <PreviewComponent {...previewProps} />
              </div>
              {/* Grid overlay */}
              {showGrid && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  {/* Rule of thirds */}
                  <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(34,211,238,0.3)' }} />
                  <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(34,211,238,0.3)' }} />
                  <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(34,211,238,0.3)' }} />
                  <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(34,211,238,0.3)' }} />
                  {/* Center cross */}
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(248,113,113,0.25)' }} />
                  <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(248,113,113,0.25)' }} />
                  {/* Safe zone lines */}
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(251,191,36,0.5)', top: `${(spacing.safeY / canvas.height) * 100}%` }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(251,191,36,0.5)', bottom: `${(spacing.safeY / canvas.height) * 100}%` }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(251,191,36,0.5)', left: `${(spacing.safeX / canvas.width) * 100}%` }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: 'rgba(251,191,36,0.5)', right: `${(spacing.safeX / canvas.width) * 100}%` }} />
                </div>
              )}
              {/* 좌우 넘기기 */}
              {selectedSlide > 0 && (
                <button
                  onClick={() => navigateSlide(-1)}
                  style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, cursor: 'pointer', border: 'none' }}
                >&#8249;</button>
              )}
              {selectedSlide < carousel.slides.length - 1 && (
                <button
                  onClick={() => navigateSlide(1)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, cursor: 'pointer', border: 'none' }}
                >&#8250;</button>
              )}
              {/* 슬라이드 번호 */}
              <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(26,26,26,0.8)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 9999 }}>
                {selectedSlide + 1}/{carousel.slides.length}
              </div>
            </div>
          )}

          {/* 모드 토글 버튼 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setShowIGPreview(false); }}
              style={{
                padding: '6px 12px', fontSize: 11, borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                background: !showIGPreview ? '#1a1a1a' : 'transparent',
                border: !showIGPreview ? '1px solid #444' : '1px solid #333',
                color: !showIGPreview ? '#fafafa' : '#666',
              }}
            >원본</button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              style={{
                padding: '6px 12px', fontSize: 11, borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                background: showGrid && !showIGPreview ? 'rgba(34,211,238,0.1)' : 'transparent',
                border: showGrid && !showIGPreview ? '1px solid rgba(34,211,238,0.4)' : '1px solid #333',
                color: showGrid && !showIGPreview ? 'rgb(34,211,238)' : '#666',
              }}
            >Grid</button>
            <button
              onClick={() => { setShowIGPreview(true); }}
              style={{
                padding: '6px 12px', fontSize: 11, borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                background: showIGPreview ? 'rgba(221,42,123,0.1)' : 'transparent',
                border: showIGPreview ? '1px solid rgba(221,42,123,0.4)' : '1px solid #333',
                color: showIGPreview ? '#dd2a7b' : '#666',
              }}
            >Instagram</button>
          </div>

          {/* 다운로드/내보내기 버튼 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={handleExport}
              style={{ width: '100%', textAlign: 'center', padding: '10px 16px', fontSize: 12, borderRadius: 8, background: '#ff6b35', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              PNG 내보내기 (클라이언트)
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleServerRender('png')}
                disabled={serverRendering}
                style={{ flex: 1, textAlign: 'center', padding: '10px 16px', fontSize: 12, borderRadius: 8, background: '#1a1a1a', border: '1px solid #333', color: '#aaa', cursor: serverRendering ? 'wait' : 'pointer', fontWeight: 500, opacity: serverRendering ? 0.5 : 1 }}
              >
                {serverRendering ? '렌더 중...' : '서버 PNG ZIP'}
              </button>
              <button
                onClick={() => handleServerRender('pdf')}
                disabled={serverRendering}
                style={{ flex: 1, textAlign: 'center', padding: '10px 16px', fontSize: 12, borderRadius: 8, background: '#1a1a1a', border: '1px solid #333', color: '#aaa', cursor: serverRendering ? 'wait' : 'pointer', fontWeight: 500, opacity: serverRendering ? 0.5 : 1 }}
              >
                {serverRendering ? '렌더 중...' : '서버 PDF'}
              </button>
            </div>
            {exportStatus && (
              <div style={{ fontSize: 12, color: '#7dd3fc' }}>{exportStatus}</div>
            )}
          </div>
        </div>

        {/* ─── 우측 패널 ─── */}
        <div style={{ width: 288, flex: 1, minWidth: 288, maxWidth: 384, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 편집 패널 */}
          {activeTemplate && (
            <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>콘텐츠 수정</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleSaveSlide}
                    disabled={saving || !dirty}
                    style={{ padding: '4px 10px', fontSize: 10, borderRadius: 8, background: dirty ? '#ff6b35' : '#333', color: '#fff', fontWeight: 500, cursor: dirty ? 'pointer' : 'default', border: 'none', opacity: saving ? 0.5 : dirty ? 1 : 0.4 }}
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>

              {/* Tabs — 항상 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                <button
                  onClick={() => setActiveTab('content')}
                  style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', border: 'none', transition: 'all .15s', background: activeTab === 'content' ? '#1a1a1a' : 'transparent', color: activeTab === 'content' ? '#fafafa' : '#666', fontWeight: activeTab === 'content' ? 600 : 400 }}
                >콘텐츠</button>
                <button
                  onClick={() => setActiveTab('style')}
                  style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, cursor: 'pointer', border: 'none', transition: 'all .15s', background: activeTab === 'style' ? '#1a1a1a' : 'transparent', color: activeTab === 'style' ? '#fafafa' : '#666', fontWeight: activeTab === 'style' ? 600 : 400 }}
                >스타일</button>
              </div>

              {/* Props controls */}
              <div style={{ maxHeight: 460, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(activeTab === 'content' ? contentEntries : styleEntries).map(([key, schema]) => (
                  <PropControl
                    key={key}
                    propKey={key}
                    schema={schema}
                    value={editableProps[key]}
                    onChange={(value) => {
                      setEditableProps((prev) => ({ ...prev, [key]: value }))
                      setDirty(true)
                    }}
                    allProps={editableProps}
                  />
                ))}
                {activeTab === 'content' && contentEntries.length === 0 && (
                  <p style={{ fontSize: 12, color: '#444', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>편집 가능한 콘텐츠가 없습니다</p>
                )}
                {activeTab === 'style' && styleEntries.length === 0 && (
                  <p style={{ fontSize: 12, color: '#444', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>스타일 옵션이 없습니다</p>
                )}
              </div>
            </div>
          )}

          {/* 캡션 입력 */}
          <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>캡션</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {captionDraft && (
                  <button
                    onClick={() => {
                      const plain = captionDraft.replace(/\*\*([^*]+)\*\*/g, '$1')
                      navigator.clipboard.writeText(plain)
                    }}
                    style={{ padding: '4px 10px', fontSize: 10, borderRadius: 8, background: 'transparent', border: '1px solid #333', color: '#888', fontWeight: 500, cursor: 'pointer' }}
                  >복사</button>
                )}
                {captionDirty && (
                  <button
                    onClick={handleCaptionSaveExplicit}
                    disabled={captionSaving}
                    style={{ padding: '4px 10px', fontSize: 10, borderRadius: 8, background: '#ff6b35', color: '#fff', fontWeight: 500, cursor: 'pointer', border: 'none', opacity: captionSaving ? 0.5 : 1 }}
                  >
                    {captionSaving ? '저장 중...' : '저장'}
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={captionDraft}
              onChange={(event) => { setCaptionDraft(event.target.value); setCaptionDirty(true) }}
              placeholder="인스타그램 캡션을 입력하세요..."
              rows={4}
              style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ccc', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 10, color: '#555', marginTop: 4, textAlign: 'right' }}>{captionDraft.length}자</div>
          </div>

          {/* 템플릿 변경 */}
          <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', marginBottom: 8 }}>
              {slide.category} 템플릿
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {relatedTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template.id)}
                  style={{
                    borderRadius: 9999,
                    border: template.id === slide.templateId ? '1px solid #ff6b35' : '1px solid #333',
                    padding: '6px 12px',
                    fontSize: 11,
                    color: template.id === slide.templateId ? '#ff6b35' : '#888',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#555' }}>
              hover 미리보기 · click 적용
            </div>
          </div>

          {/* Auto Generate */}
          <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#666', marginBottom: 8 }}>Auto Generate</div>
            <textarea
              value={generatePrompt}
              onChange={(event) => setGeneratePrompt(event.target.value)}
              rows={4}
              style={{ width: '100%', borderRadius: 8, border: '1px solid #222', background: '#0a0a0a', padding: '8px 12px', fontSize: 12, color: '#ddd', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              placeholder="원문이나 메모를 넣으면 slide deck으로 재구성합니다"
            />
            <button
              onClick={() => handleGenerate()}
              disabled={generating}
              style={{ marginTop: 8, width: '100%', borderRadius: 8, background: '#163260', padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#dbeafe', border: 'none', cursor: 'pointer', opacity: generating ? 0.5 : 1 }}
            >
              {generating ? '생성 중...' : '자동 생성'}
            </button>
            {generateStatus && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#7dd3fc' }}>{generateStatus}</div>
            )}
          </div>
        </div>
      </div>

      {/* 슬라이드 네비게이션 (썸네일) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24, justifyContent: 'center' }}>
        {carousel.slides.map((item, index) => {
          // 현재 선택된 슬라이드는 editableProps 반영
          const thumbSlide = index === selectedSlide
            ? { ...item, ...(previewTemplateId ? { templateId: previewTemplateId } : {}) }
            : item
          const thumbProps = index === selectedSlide ? previewProps : undefined
          return (
          <button
            key={item.id ?? index}
            onClick={() => { setSelectedSlide(index); setPreviewTemplateId(null) }}
            style={{
              position: 'relative', borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
              border: index === selectedSlide ? '2px solid #ff6b35' : '2px solid #222',
              width: 200, height: Math.round(canvas.height * (200 / canvas.width)),
              background: '#111', padding: 0,
            }}
          >
            <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
              <SlideDeckThumbnail slide={thumbSlide} slideIndex={index} totalSlides={carousel.slides.length} scale={200 / canvas.width} overrideProps={thumbProps} />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', fontSize: 9, color: '#aaa', textAlign: 'center', padding: '2px 0' }}>
              {index + 1}
            </div>
          </button>
          )
        })}
      </div>

      {/* 슬라이드 추가/삭제 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        <button onClick={() => handleAddSlide('hook')} style={{ borderRadius: 8, border: '1px solid #222', background: '#111', padding: '8px 16px', fontSize: 12, color: '#ccc', cursor: 'pointer' }}>훅 추가</button>
        <button onClick={() => handleAddSlide('body')} style={{ borderRadius: 8, border: '1px solid #222', background: '#111', padding: '8px 16px', fontSize: 12, color: '#ccc', cursor: 'pointer' }}>본문 추가</button>
        <button onClick={() => handleAddSlide('cta')} style={{ borderRadius: 8, border: '1px solid #222', background: '#111', padding: '8px 16px', fontSize: 12, color: '#ccc', cursor: 'pointer' }}>CTA 추가</button>
        <button onClick={handleDeleteSlide} disabled={carousel.slides.length <= 1} style={{ borderRadius: 8, border: '1px solid #2d1414', background: '#160d0d', padding: '8px 16px', fontSize: 12, color: '#f19999', cursor: 'pointer', opacity: carousel.slides.length <= 1 ? 0.4 : 1 }}>슬라이드 삭제</button>
      </div>
    </div>
  )
}
