import { SlideTitle, MutedText, AccentBar } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CoverCountdownProps extends BaseSlideStyleProps {
  count: string
  title: string
  subtitle: string
  titleFontSize?: number
  subtitleFontSize?: number
}

export const coverCountdownDefaultProps: CoverCountdownProps = {
  count: '7',
  title: '당신이 모르는\n치명적인 실수',
  subtitle: '마지막이 가장 충격적입니다',
  ...DEFAULT_COLORS,
}

export function CoverCountdown({ count, title, subtitle, titleFontSize, subtitleFontSize, ...colors }: CoverCountdownProps) {
  const accent = colors.accentColor || '#ff6b6b'
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: colors.textAlign || 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <div style={{ fontSize: 260, fontWeight: fontWeight.black, lineHeight: 0.85, ...gradientTextStyle(accent, colors.accentColorEnd), marginBottom: gap['3xl'] }}>
          {count}
        </div>
        <SlideTitle variant="hero" style={{ fontSize: titleFontSize ?? fontSize.coverCompact, fontWeight: fontWeight.black }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <AccentBar variant="wide" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['2xl'] }} />
        <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['2xl'], fontSize: subtitleFontSize ?? fontSize.bodyMd }}>
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
