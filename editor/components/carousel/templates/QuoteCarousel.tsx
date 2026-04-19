'use client'

import { AbsoluteFill } from './AbsoluteFill'
import { Watermark } from './Watermark'
import { BRXCE_BRAND } from '../brand'
import type { QuoteCarouselProps, QuoteItem } from '../types'

const CoverSlide: React.FC<{ title: string; subtitle?: string; accentColor: string }> = ({ title, subtitle, accentColor }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80, justifyContent: 'center', position: 'relative' }}>
    <div style={{ position: 'absolute', top: 60, left: 60, fontSize: 200, fontFamily: 'Georgia, serif', fontWeight: 700, color: accentColor, opacity: 0.15, lineHeight: 1, userSelect: 'none' }}>&ldquo;</div>
    <div style={{ padding: '8px 20px', borderRadius: 8, backgroundColor: `${accentColor}22`, border: `1px solid ${accentColor}44`, display: 'inline-flex', alignSelf: 'flex-start', marginBottom: 40 }}>
      <span style={{ fontSize: 16, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 700, color: accentColor, letterSpacing: 1 }}>INSIGHTS</span>
    </div>
    <h1 style={{ fontSize: 56, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 800, color: BRXCE_BRAND.colors.text, lineHeight: 1.25, letterSpacing: -1.5, margin: 0 }}>{title}</h1>
    {subtitle && <p style={{ fontSize: 26, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted, lineHeight: 1.6, margin: 0, marginTop: 24 }}>{subtitle}</p>}
    <Watermark />
  </AbsoluteFill>
)

const QuoteSlide: React.FC<{ quote: QuoteItem; slideNumber: number; totalQuotes: number; accentColor: string }> = ({ quote, slideNumber, totalQuotes, accentColor }) => (
  <AbsoluteFill style={{ backgroundColor: BRXCE_BRAND.colors.background, padding: 80, justifyContent: 'center', position: 'relative' }}>
    <div style={{ position: 'absolute', top: 48, right: 64, fontSize: 16, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 500, color: BRXCE_BRAND.colors.textMuted }}>{slideNumber}/{totalQuotes}</div>
    <div style={{ fontSize: 120, fontFamily: 'Georgia, serif', fontWeight: 700, color: accentColor, lineHeight: 0.8, marginBottom: 24, userSelect: 'none' }}>&ldquo;</div>
    <p style={{ fontSize: 38, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 600, color: BRXCE_BRAND.colors.text, lineHeight: 1.6, margin: 0, marginBottom: 48, whiteSpace: 'pre-line' }}>{quote.text}</p>
    <div style={{ width: 48, height: 3, backgroundColor: accentColor, borderRadius: 2, marginBottom: 32 }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {quote.emoji && <span style={{ fontSize: 36 }}>{quote.emoji}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 24, fontFamily: BRXCE_BRAND.fonts.headline, fontWeight: 700, color: BRXCE_BRAND.colors.text }}>{quote.author}</span>
        {quote.role && <span style={{ fontSize: 18, fontFamily: BRXCE_BRAND.fonts.body, fontWeight: 400, color: BRXCE_BRAND.colors.textMuted }}>{quote.role}</span>}
      </div>
    </div>
    <div style={{ position: 'absolute', bottom: 80, right: 80, fontSize: 120, fontFamily: 'Georgia, serif', fontWeight: 700, color: accentColor, opacity: 0.1, lineHeight: 0.8, transform: 'rotate(180deg)', userSelect: 'none' }}>&ldquo;</div>
    <Watermark />
  </AbsoluteFill>
)

export const QuoteCarousel: React.FC<QuoteCarouselProps> = ({
  slideIndex, quotes, collectionTitle, collectionSubtitle, accentColor = BRXCE_BRAND.colors.accent,
}) => {
  if (slideIndex === 0) return <CoverSlide title={collectionTitle} subtitle={collectionSubtitle} accentColor={accentColor} />
  const quote = quotes[slideIndex - 1]
  if (!quote) return null
  return <QuoteSlide quote={quote} slideNumber={slideIndex} totalQuotes={quotes.length} accentColor={accentColor} />
}
