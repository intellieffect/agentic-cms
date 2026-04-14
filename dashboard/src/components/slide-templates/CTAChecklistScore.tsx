import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CTAChecklistScoreProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  ranges: { range: string; label: string; emoji: string }[]
  footer?: string
  prompt?: string
}

export const ctaChecklistScoreDefaultProps: CTAChecklistScoreProps = {
  title: '몇 개 해당되셨나요?',
  ranges: [
    { range: '0–1개', label: '아직 시작 전', emoji: '🌱' },
    { range: '2–3개', label: '기초는 잡혀있음', emoji: '🔥' },
    { range: '4–5개', label: '이미 프로', emoji: '🚀' },
  ],
  footer: '점수를 댓글로 남겨주세요 👇',
  prompt: '#자가진단 #체크리스트',
  ...DEFAULT_COLORS,
}

export function CTAChecklistScore({ title, ranges, footer, prompt, titleFontSize, ...colors }: CTAChecklistScoreProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.headingLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, textAlign: 'center' as const }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>

        <div style={{ marginTop: gap['3xl'], display: 'flex', flexDirection: 'column', gap: gap.xl, width: '100%' }}>
          {(ranges || []).map((r, idx) => (
            <div
              key={`score-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: gap.lg,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 16,
                padding: `${gap.lg}px ${gap.xl}px`,
              }}
            >
              <span style={{ fontSize: 40, lineHeight: 1, minWidth: 52, textAlign: 'center' as const }}>{r.emoji}</span>
              <div style={{ textAlign: 'left' as const, flex: 1 }}>
                <span style={{ fontSize: fontSize.bodySm, fontWeight: fontWeight.bold, display: 'block', ...gradientTextStyle(accent, colors.accentColorEnd) }}>
                  {r.range}
                </span>
                <MutedText size="md" mutedColor={colors.textColor || '#ffffff'} style={{ fontSize: fontSize.bodyXs, fontWeight: fontWeight.medium }}>
                  {r.label}
                </MutedText>
              </div>
            </div>
          ))}
        </div>

        {footer && (
          <MutedText size="lg" mutedColor={colors.textColor || '#ffffff'} style={{ marginTop: gap['3xl'], fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold }}>
            {footer}
          </MutedText>
        )}

        {prompt && (
          <MutedText size="md" mutedColor={`${accent}80`} style={{ marginTop: gap.lg, fontSize: fontSize.captionLg }}>
            {prompt}
          </MutedText>
        )}
      </div>
    </SlideBase>
  )
}
