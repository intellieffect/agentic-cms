import { SlideTitle, CTAButton, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout, accentOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTAFollowProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  handle: string
  reason: string
  hintText?: string
}

export const ctaFollowDefaultProps: CTAFollowProps = {
  title: '실전 템플릿이 더 필요하다면?',
  handle: '@brxce.ai',
  reason: '팔로우하고 매주 새로운 템플릿을 받아보세요.',
  hintText: '↑ 프로필에서 팔로우',
  ...DEFAULT_COLORS,
}

export function CTAFollow({ title, handle, reason, hintText, titleFontSize, ...colors }: CTAFollowProps) {
  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingBottom: spacing.bottomLg, paddingTop: spacing.topSm }}
      >
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="title"
          style={{ maxWidth: layout.maxWidth.title, fontSize: titleFontSize ?? fontSize.ctaSm, fontWeight: fontWeight.bold, lineHeight: lineHeight.snug }}
        >
          {title}
        </SlideTitle>
        <CTAButton accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['5xl'] }}>
          팔로우 {handle}
        </CTAButton>
        {hintText ? (
          <MutedText
            size="md"
            mutedColor={`${colors.accentColor}${accentOpacity.hint}`}
            style={{ marginTop: gap.md, fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold }}
          >
            {hintText}
          </MutedText>
        ) : null}
        <MutedText
          size="md"
          mutedColor={colors.mutedColor}
          style={{ marginTop: gap['3xl'], maxWidth: layout.maxWidth.content, fontSize: fontSize.bodySm, lineHeight: lineHeight.relaxed }}
        >
          {reason}
        </MutedText>
        <MutedText
          size="md"
          mutedColor={colors.mutedColor}
          style={{ marginTop: gap.sm, maxWidth: layout.maxWidth.content, fontSize: fontSize.captionLg, lineHeight: lineHeight.relaxed }}
        >
          실제 자동화 워크플로우, 프롬프트, 운영 체크리스트까지 받아보세요.
        </MutedText>
      </div>
    </SlideBase>
  )
}
