import { Overline, SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, accentOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverCenteredProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  kicker: string
}

export const coverCenteredDefaultProps: CoverCenteredProps = {
  title: '매출을 높이는\n콘텐츠 구조',
  subtitle: '핵심만 담은 5분 가이드',
  kicker: 'INSTAGRAM CAROUSEL',
  ...DEFAULT_COLORS,
}

export function CoverCentered({ title, subtitle, kicker, titleFontSize, subtitleFontSize, ...colors }: CoverCenteredProps) {
  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        <Overline variant="kicker" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd} style={{ marginBottom: gap['4xl'] }}>
          {kicker}
        </Overline>
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="hero"
          style={{ fontSize: titleFontSize ?? fontSize.coverLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
        >
          {title}
        </SlideTitle>
        <AccentBar
          variant="narrow"
          accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}
          opacity={accentOpacity.full}
          style={{ marginTop: gap['5xl'], marginBottom: gap['5xl'], width: 160, borderRadius: 0, height: 4 }}
        />
        <MutedText size="lg" mutedColor="#ffffff" style={{ fontSize: subtitleFontSize ?? fontSize.bodyMd }}>
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
