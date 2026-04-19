import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderRadius, borderColor, cardBackground } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyScorecardProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  items: { label: string; score: number; max?: number }[]
  maxScore?: number
}

export const bodyScorecardDefaultProps: BodyScorecardProps = {
  title: '콘텐츠 채널 효율 비교',
  items: [
    { label: '인스타 캐러셀', score: 95 },
    { label: '블로그 포스트', score: 70 },
    { label: '유튜브 쇼츠', score: 85 },
    { label: '뉴스레터', score: 60 },
  ],
  maxScore: 100,
  ...DEFAULT_COLORS,
}

export function BodyScorecard({ title, items, maxScore = 100, titleFontSize, bodyFontSize, barHeight, cardWidth, ...colors }: BodyScorecardProps & { barHeight?: number; cardWidth?: number }) {
  const accent = colors.accentColor ?? '#ff6b6b'
  const parsedItems = Array.isArray(items)
    ? (items || []).map((item) =>
        typeof item === 'string'
          ? { label: item, score: 50 }
          : item
      )
    : []
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, marginBottom: gap['5xl'] }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.xl, ...(cardWidth != null ? { width: cardWidth } : {}) }}>
          {parsedItems.map((item, i) => {
            const itemMax = item.max ?? maxScore
            const pct = Math.min((item.score / itemMax) * 100, 100)
            return (
              <div key={i} style={{ padding: '24px 28px', background: cardBackground.light, border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.lg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: gap.sm }}>
                  <span style={{ fontSize: bodyFontSize ?? fontSize.bodySm, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.9)' }}>{item.label}</span>
                  <span style={{ fontSize: fontSize.bodySm, fontWeight: fontWeight.bold, ...gradientTextStyle(accent, colors.accentColorEnd) }}>{item.score}/{itemMax}</span>
                </div>
                <div style={{ height: barHeight ?? 12, background: 'rgba(255,255,255,0.08)', borderRadius: borderRadius.full, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: borderRadius.full, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SlideBase>
  )
}
