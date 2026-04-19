import { Overline, SlideTitle, LinkBox, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTALinkProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  linkLabel: string
  linkValue: string
  caption: string
}

// linkValue 는 env NEXT_PUBLIC_CONTACT_DOMAIN 로 주입 (multi-tenant)
// 예: "brxce.ai/studio" 같은 tenant 특정 경로
export const ctaLinkDefaultProps: CTALinkProps = {
  title: '전체 가이드는 프로필 링크에서',
  linkLabel: 'LINK',
  linkValue: process.env.NEXT_PUBLIC_CONTACT_DOMAIN || '',
  caption: '프로필 방문 후 무료 템플릿을 받아보세요.',
  ...DEFAULT_COLORS,
}

export function CTALink({ title, linkLabel, linkValue, caption, titleFontSize, ...colors }: CTALinkProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="title"
          style={{ fontSize: titleFontSize ?? fontSize.ctaMd, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
        >
          {title}
        </SlideTitle>
        <div style={{ marginTop: gap['5xl'] }}>
          <Overline variant="linkLabel" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}>
            {linkLabel}
          </Overline>
          <LinkBox
            value={linkValue}
            accentColor={colors.accentColor}
            style={{ marginTop: gap.xs }}
          />
        </div>
        <MutedText size="md" mutedColor={colors.mutedColor} style={{ marginTop: gap['4xl'], fontSize: fontSize.captionLg }}>
          {caption}
        </MutedText>
      </div>
    </SlideBase>
  )
}
