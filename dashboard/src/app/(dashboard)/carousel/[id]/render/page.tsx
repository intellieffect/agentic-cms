'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getEditorConfig } from '@/lib/editor-config'
import { SlideDeckThumbnail } from '@/components/carousel/SlideDeckThumbnail'
import {
  defaultSlides,
  type SlideDeckProject,
  type SlideDeckSlide,
} from '@/components/carousel/slide-deck'

const SLIDE_W = 1080
const SLIDE_H = 1350

function normalizeProject(data: Record<string, unknown>): SlideDeckProject | null {
  if (!data || !data.id) return null
  return {
    id: data.id as string,
    title: (data.title as string) || '캐러셀',
    caption: data.caption as string | undefined,
    slides: Array.isArray(data.slides) ? data.slides : defaultSlides((data.title as string) || '캐러셀'),
    created_at: data.created_at as string | undefined,
    updated_at: data.updated_at as string | undefined,
  }
}

export default function CarouselRenderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const slideParam = searchParams.get('slide') ?? 'all'

  const [carousel, setCarousel] = useState<SlideDeckProject | null>(null)
  const [error, setError] = useState('')

  const apiUrl = getEditorConfig().apiUrl

  useEffect(() => {
    if (!id) return
    fetch(`${apiUrl}/api/carousels/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then((d) => {
        const project = normalizeProject(d)
        if (!project) throw new Error('데이터 없음')
        setCarousel(project)
      })
      .catch((e) => setError('로드 실패: ' + (e instanceof Error ? e.message : String(e))))
  }, [id, apiUrl])

  if (error) return <div style={{ color: '#f88', padding: 40 }}>{error}</div>
  if (!carousel) return <div style={{ color: '#888', padding: 40 }}>로딩 중...</div>

  const slides = carousel.slides
  const total = slides.length

  let slideIndices: number[]
  if (slideParam === 'all') {
    slideIndices = Array.from({ length: total }, (_, i) => i)
  } else {
    slideIndices = slideParam
      .split(',')
      .map(Number)
      .filter((n) => !isNaN(n) && n >= 0 && n < total)
  }

  return (
    <div style={{ background: '#0A0A0A' }}>
      <style>{`body { height: auto !important; overflow: visible !important; }`}</style>
      {slideIndices.map((idx) => (
        <div
          key={idx}
          data-slide-index={idx}
          className="render-slide"
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#0A0A0A',
          }}
        >
          <SlideDeckThumbnail
            slide={slides[idx]}
            slideIndex={idx}
            totalSlides={total}
            scale={1}
          />
        </div>
      ))}
    </div>
  )
}
