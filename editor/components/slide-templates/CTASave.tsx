import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, textOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTASaveProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  subtitle: string
  tip: string
}

export const ctaSaveDefaultProps: CTASaveProps = {
  title: '나중에 바로 쓰려면\n지금 저장하세요',
  subtitle: '저장해두면 다음 콘텐츠 제작이 10배 빨라집니다.',
  tip: '우측 상단 ••• 버튼 > 저장',
  ...DEFAULT_COLORS,
}

export function CTASave({ title, subtitle, tip, titleFontSize, ...colors }: CTASaveProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="hero"
          style={{ fontSize: titleFontSize ?? fontSize.ctaXl, fontWeight: fontWeight.black, lineHeight: lineHeight.default }}
        >
          {title}
        </SlideTitle>
        <MutedText size="lg" mutedColor={textOpacity.secondary} style={{ marginTop: gap['4xl'], fontSize: fontSize.bodyMd }}>
          {subtitle}
        </MutedText>
        <MutedText size="md" mutedColor={colors.accentColor} style={{ marginTop: gap['4xl'], fontSize: fontSize.captionLg, ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${colors.accentColor}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}) }}>
          {tip}
        </MutedText>
      </div>
    </SlideBase>
  )
}
