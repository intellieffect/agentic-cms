import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, textOpacity } from '@/lib/studio/slide-tokens'
import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverGradientProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  gradientFrom?: string
  gradientTo?: string
}

export const coverGradientDefaultProps: CoverGradientProps = {
  title: '브랜드를 남기는\n콘텐츠 제작법',
  subtitle: '실전 템플릿 19종 공개',
  gradientFrom: '#1a1a1a',
  gradientTo: '#ff6b6b',
  ...DEFAULT_COLORS,
}

export function CoverGradient({ title, subtitle, gradientFrom, gradientTo, titleFontSize, subtitleFontSize, ...colors }: CoverGradientProps) {
  return (
    <SlideBase
      {...colors}
      style={{
        background: `radial-gradient(circle at 20% 10%, ${gradientTo}55, transparent 40%), linear-gradient(135deg, ${gradientFrom}, #0a0a0a 70%)`,
      }}
    >
      <div style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <SlideTitle
          variant="hero"
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          style={{ fontSize: titleFontSize ?? fontSize.coverXl, fontWeight: fontWeight.black, lineHeight: lineHeight.tightest }}
        >
          {title}
        </SlideTitle>
        <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['4xl'], fontSize: subtitleFontSize ?? fontSize.bodyMd }}>
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
