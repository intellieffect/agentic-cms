import { SlideTitle, CTAButton, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderRadius, borderColor, cardBackground, accentOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CTASocialProofProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  metrics: { value: string; label: string }[]
  cta: string
  handle: string
}

export const ctaSocialProofDefaultProps: CTASocialProofProps = {
  title: '이미 많은 분들이\n함께하고 있습니다',
  metrics: [
    { value: '2,400+', label: '팔로워' },
    { value: '150+', label: '캐러셀 제작' },
    { value: '98%', label: '만족도' },
  ],
  cta: '지금 시작하기',
  handle: process.env.NEXT_PUBLIC_BRAND_HANDLE || '',
  ...DEFAULT_COLORS,
}

export function CTASocialProof({ title, metrics, cta, handle, titleFontSize, bodyFontSize, ...colors }: CTASocialProofProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  const parsedMetrics = Array.isArray(metrics)
    ? (metrics || []).map((m) => typeof m === 'string' ? { value: m, label: '' } : m)
    : []
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.ctaSm, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, textAlign: 'center' }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        {/* Metrics */}
        <div style={{ marginTop: gap['5xl'], display: 'grid', gridTemplateColumns: `repeat(${Math.min(parsedMetrics.length, 3)}, 1fr)`, gap: gap.lg }}>
          {parsedMetrics.map((m, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '32px 16px', background: cardBackground.light, border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.xl }}>
              <p style={{ fontSize: bodyFontSize ?? fontSize.hookMd, fontWeight: fontWeight.black, lineHeight: lineHeight.none, ...gradientTextStyle(accent, colors.accentColorEnd) }}>{m.value}</p>
              <p style={{ fontSize: bodyFontSize ? bodyFontSize * 0.55 : fontSize.captionLg, fontWeight: fontWeight.medium, color: 'rgba(255,255,255,0.6)', marginTop: gap.md }}>{m.label}</p>
            </div>
          ))}
        </div>
        {/* CTA */}
        <CTAButton accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['5xl'] }}>
          {cta}
        </CTAButton>
        <MutedText size="md" mutedColor={`${accent}${accentOpacity.hint}`} style={{ marginTop: gap.lg, fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, textAlign: 'center' }}>
          {handle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
