'use client'

import { canvas } from '@/lib/studio/slide-tokens'
import { SLIDE_TEMPLATES } from '@/lib/studio/slide-templates'
import { resolveSlideProps, type SlideDeckSlide } from './slide-deck'

const DEFAULT_SCALE = 0.2

export function SlideDeckThumbnail({
  slide,
  slideIndex,
  totalSlides,
  scale = DEFAULT_SCALE,
  overrideProps,
}: {
  slide: SlideDeckSlide
  slideIndex: number
  totalSlides: number
  scale?: number
  overrideProps?: Record<string, unknown>
}) {
  const template = SLIDE_TEMPLATES.find((item) => item.id === slide.templateId)
  if (!template) {
    return <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#555" }}>{slideIndex + 1}</div>
  }
  const Component = template.component
  const props = overrideProps || resolveSlideProps(slide, slideIndex, totalSlides)

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#0a0a0a" }}>
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: canvas.width,
          height: canvas.height,
          pointerEvents: 'none',
        }}
      >
        <Component {...props} />
      </div>
    </div>
  )
}

export function getThumbnailSize(scale = DEFAULT_SCALE) {
  return {
    width: Math.round(canvas.width * scale),
    height: Math.round(canvas.height * scale),
  }
}
