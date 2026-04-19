'use client'

import { AbsoluteFill } from './AbsoluteFill'
import { Watermark } from './Watermark'
import { BRXCE_BRAND } from '../brand'
import type { ListCarouselProps, ListSlideData, ListItem } from '../types'

const CoverSlide: React.FC<{ title: string; subtitle?: string; accentColor: string }> = ({ title, subtitle, accentColor }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80, justifyContent: 'center' }}>
    <div style={{ position: 'absolute', top: -40, right: -20, fontSize: 320, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 900, color: BRXCE_BRAND.colors.surface, opacity: 0.3, lineHeight: 1, userSelect: 'none' }}>#</div>
    <div style={{ padding: '8px 20px', borderRadius: 8, backgroundColor: `${accentColor}22`, border: `1px solid ${accentColor}44`, display: 'inline-flex', alignSelf: 'flex-start', marginBottom: 40 }}>
      <span style={{ fontSize: 16, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 700, color: accentColor, letterSpacing: 1 }}>LIST</span>
    </div>
    <h1 style={{ fontSize: 60, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: BRXCE_BRAND.colors.text, lineHeight: 1.2, letterSpacing: -1.5, margin: 0 }}>{title}</h1>
    {subtitle && <p style={{ fontSize: 26, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.6, margin: 0, marginTop: 24 }}>{subtitle}</p>}
    <Watermark />
  </AbsoluteFill>
)

const ListSlideContent: React.FC<{
  slide: ListSlideData; numbered: boolean; startNumber: number; slideIndex: number; totalSlides: number; accentColor: string; previousItemCount: number
}> = ({ slide, numbered, startNumber, slideIndex, totalSlides, accentColor, previousItemCount }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: '64px 64px 96px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
      {slide.heading && <h3 style={{ fontSize: 28, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 700, color: BRXCE_BRAND.colors.text, margin: 0 }}>{slide.heading}</h3>}
      <span style={{ fontSize: 16, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 500, color: BRXCE_BRAND.colors.textMuted, marginLeft: 'auto' }}>{slideIndex}/{totalSlides}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
      {slide.items.map((item, i) => {
        const itemNumber = startNumber + previousItemCount + i
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: '28px 32px', borderRadius: 16, backgroundColor: BRXCE_BRAND.colors.surface, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ minWidth: 48, height: 48, borderRadius: 12, backgroundColor: numbered ? accentColor : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.emoji && !numbered ? (
                <span style={{ fontSize: 28 }}>{item.emoji}</span>
              ) : (
                <span style={{ fontSize: 22, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: '#FFFFFF' }}>{itemNumber}</span>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 26, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 600, color: BRXCE_BRAND.colors.text, lineHeight: 1.3 }}>{item.title}</span>
              {item.description && <span style={{ fontSize: 20, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.5 }}>{item.description}</span>}
            </div>
          </div>
        )
      })}
    </div>
    <Watermark />
  </AbsoluteFill>
)

export const ListCarousel: React.FC<ListCarouselProps> = ({
  slideIndex, slides, listTitle, listSubtitle, numbered = true, startNumber = 1, accentColor = BRXCE_BRAND.colors.primary,
}) => {
  if (slideIndex === 0) return <CoverSlide title={listTitle} subtitle={listSubtitle} accentColor={accentColor} />
  const listIndex = slideIndex - 1
  const slide = slides[listIndex]
  if (!slide) return null
  const previousItemCount = slides.slice(0, listIndex).reduce((acc, s) => acc + s.items.length, 0)
  return <ListSlideContent slide={slide} numbered={numbered} startNumber={startNumber} slideIndex={slideIndex} totalSlides={slides.length} accentColor={accentColor} previousItemCount={previousItemCount} />
}
