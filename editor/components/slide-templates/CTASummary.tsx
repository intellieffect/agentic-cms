import { SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderRadius, borderColor, cardBackground } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTASummaryProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  points: string[]
  cta: string
}

export const ctaSummaryDefaultProps: CTASummaryProps = {
  title: '오늘 배운 것 정리',
  points: [
    '캐러셀은 7~10장이 최적',
    '첫 슬라이드에서 호기심 유발',
    '마지막 슬라이드에 CTA 필수',
    '일관된 브랜드 컬러 유지',
  ],
  cta: '저장하고 나중에 다시 보세요 🔖',
  ...DEFAULT_COLORS,
}

export function CTASummary({ title, points, cta, titleFontSize, bodyFontSize, ...colors }: CTASummaryProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  const parsedPoints = Array.isArray(points) ? points : []
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <AccentBar variant="defaultRound" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['3xl'], marginBottom: gap['3xl'] }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.md }}>
          {parsedPoints.map((point, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: gap.md, padding: '20px 24px', background: cardBackground.light, border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.lg }}>
              <span style={{ width: 40, height: 40, borderRadius: borderRadius.full, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fontSize.captionSm, fontWeight: fontWeight.bold, color: '#fff', flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: bodyFontSize ?? fontSize.bodySm, lineHeight: lineHeight.relaxed, color: 'rgba(255,255,255,0.9)' }}>{point}</span>
            </div>
          ))}
        </div>
        <MutedText size="lg" mutedColor={accent} style={{ marginTop: gap['4xl'], fontSize: fontSize.subHeading, fontWeight: fontWeight.semibold, textAlign: 'center' }}>
          {cta}
        </MutedText>
      </div>
    </SlideBase>
  )
}
