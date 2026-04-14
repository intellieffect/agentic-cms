'use client'

import { AbsoluteFill } from './AbsoluteFill'
import { Watermark } from './Watermark'
import { BRXCE_BRAND } from '../brand'
import type { CardNewsProps, CardNewsSlide } from '../types'

const CoverSlide: React.FC<{
  title: string; subtitle?: string; accentColor: string; handle: string
}> = ({ title, subtitle, accentColor, handle }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80, justifyContent: 'center' }}>
    <div style={{ width: 64, height: 4, backgroundColor: accentColor, borderRadius: 2, marginBottom: 48 }} />
    <h1 style={{ fontSize: 64, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: BRXCE_BRAND.colors.text, lineHeight: 1.2, letterSpacing: -1.5, margin: 0 }}>{title}</h1>
    {subtitle && <p style={{ fontSize: 28, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.6, margin: 0, marginTop: 24 }}>{subtitle}</p>}
    <div style={{ position: 'absolute', bottom: 100, left: 80, display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 18, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 500, color: BRXCE_BRAND.colors.textMuted, letterSpacing: 1 }}>SWIPE →</span>
    </div>
    <Watermark handle={handle} />
  </AbsoluteFill>
)

const ContentSlide: React.FC<{
  slide: CardNewsSlide; slideNumber: number; totalSlides: number; accentColor: string; handle: string
}> = ({ slide, slideNumber, totalSlides, accentColor, handle }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 28, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: '#FFFFFF' }}>{slideNumber}</span>
      </div>
      <div style={{ fontSize: 16, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 500, color: BRXCE_BRAND.colors.textMuted, letterSpacing: 1 }}>{slideNumber} / {totalSlides}</div>
    </div>
    <h2 style={{ fontSize: 44, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 700, color: BRXCE_BRAND.colors.text, lineHeight: 1.3, letterSpacing: -0.5, margin: 0, marginBottom: 32 }}>{slide.title}</h2>
    <div style={{ width: '100%', height: 1, backgroundColor: BRXCE_BRAND.colors.surface, marginBottom: 32 }} />
    {slide.body && <p style={{ fontSize: 26, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-line' }}>{slide.body}</p>}
    <Watermark handle={handle} />
  </AbsoluteFill>
)

const CtaSlide: React.FC<{ handle: string; accentColor: string }> = ({ handle, accentColor }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, justifyContent: 'center', alignItems: 'center', gap: 32 }}>
    <span style={{ fontSize: 72 }}>{BRXCE_BRAND.logo.emoji}</span>
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 32, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 600, color: BRXCE_BRAND.colors.text, margin: 0, marginBottom: 12 }}>더 많은 인사이트가 궁금하다면</p>
      <p style={{ fontSize: 36, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: accentColor, margin: 0 }}>{handle}</p>
    </div>
    <div style={{ marginTop: 24, padding: '16px 32px', borderRadius: 12, backgroundColor: BRXCE_BRAND.colors.surface }}>
      <span style={{ fontSize: 20, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 500, color: BRXCE_BRAND.colors.textMuted }}>저장하고 나중에 다시 보기</span>
    </div>
  </AbsoluteFill>
)

export const CardNews: React.FC<CardNewsProps> = ({
  slideIndex, slides, coverTitle, coverSubtitle, ctaHandle = '@brxce.ai', accentColor = BRXCE_BRAND.colors.primary,
}) => {
  const totalSlides = slides.length + 2
  if (slideIndex === 0) return <CoverSlide title={coverTitle} subtitle={coverSubtitle} accentColor={accentColor} handle={ctaHandle} />
  if (slideIndex === totalSlides - 1) return <CtaSlide handle={ctaHandle} accentColor={accentColor} />
  const slide = slides[slideIndex - 1]
  if (!slide) return null
  return <ContentSlide slide={slide} slideNumber={slideIndex} totalSlides={slides.length} accentColor={accentColor} handle={ctaHandle} />
}
