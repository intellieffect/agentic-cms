import { SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout, accentOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverMinimalProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  issue: string
}

export const coverMinimalDefaultProps: CoverMinimalProps = {
  title: '좋은 콘텐츠는\n구조에서 시작됩니다',
  subtitle: '작지만 강한 차이를 만드는 프레임워크',
  issue: 'NO. 19',
  ...DEFAULT_COLORS,
}

export function CoverMinimal({ title, subtitle, issue, titleFontSize, subtitleFontSize, ...colors }: CoverMinimalProps) {
  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "space-between", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        <MutedText size="sm" mutedColor={colors.textColor || "#ffffff"}>
          {issue}
        </MutedText>
        <div style={{ paddingBottom: spacing.bottomXl }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
              variant="hero"
              style={{ fontSize: titleFontSize ?? fontSize.coverSm, fontWeight: fontWeight.semibold, lineHeight: lineHeight.default }}
            >
              {title}
            </SlideTitle>
            <MutedText size="lg" mutedColor={colors.textColor || "#ffffff"} style={{ maxWidth: layout.maxWidth.subtitle, fontSize: subtitleFontSize ?? fontSize.bodyMd }}>
              {subtitle}
            </MutedText>
            <AccentBar
              variant="narrow"
              accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}
              opacity={accentOpacity.full}
              style={{ width: 144, borderRadius: 0, height: 4 }}
            />
          </div>
        </div>
      </div>
    </SlideBase>
  )
}
