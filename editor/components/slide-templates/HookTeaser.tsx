import { Overline, SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, textOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookTeaserProps extends BaseSlideStyleProps {
  titleFontSize?: number
  overline: string
  title: string
  teaser: string
}

export const hookTeaserDefaultProps: HookTeaserProps = {
  overline: '잠깐, 다음 슬라이드에서',
  title: '조회수보다 중요한\n전환 구조를 공개합니다',
  teaser: '끝까지 보면 바로 적용할 수 있어요.',
  ...DEFAULT_COLORS,
}

export function HookTeaser({ overline, title, teaser, titleFontSize, ...colors }: HookTeaserProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <Overline variant="kicker" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd} style={{ fontSize: fontSize.captionLg, letterSpacing: 'normal', textTransform: 'none' }}>
          {overline}
        </Overline>
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="hero"
          style={{ marginTop: gap['3xl'], fontSize: titleFontSize ?? fontSize.hookLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
        >
          {title}
        </SlideTitle>
        <MutedText size="lg" mutedColor={textOpacity.tertiary} style={{ marginTop: gap['5xl'], fontSize: fontSize.bodyMd }}>
          {teaser}
        </MutedText>
      </div>
    </SlideBase>
  )
}
