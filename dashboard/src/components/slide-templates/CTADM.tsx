import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTADMProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  keyword: string
  description: string
  prompt?: string
}

export const ctaDMDefaultProps: CTADMProps = {
  title: '템플릿이 필요하시면\nDM 보내주세요',
  keyword: 'TEMPLATE',
  description: '아래 키워드를 DM으로 보내주시면\n무료 템플릿을 보내드립니다.',
  prompt: '#DM #무료템플릿',
  ...DEFAULT_COLORS,
}

export function CTADM({ title, keyword, description, prompt, titleFontSize, ...colors }: CTADMProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* DM icon */}
        <div style={{ marginBottom: gap['2xl'] }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>

        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.headingLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, textAlign: 'center' as const }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>

        {/* Keyword badge */}
        <div
          style={{
            marginTop: gap['3xl'],
            background: colors.accentColorEnd ? `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})` : accent,
            color: '#ffffff',
            fontSize: fontSize.subtitleLg,
            fontWeight: fontWeight.black,
            padding: `${gap.lg}px ${gap['3xl']}px`,
            borderRadius: 16,
            letterSpacing: '0.1em',
          }}
        >
          &ldquo;{keyword}&rdquo;
        </div>

        <MutedText size="lg" mutedColor={colors.mutedColor || '#ffffff'} style={{ marginTop: gap['2xl'], fontSize: fontSize.bodySm, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const }}>
          {description}
        </MutedText>

        {prompt && (
          <MutedText size="md" mutedColor={`${accent}80`} style={{ marginTop: gap['2xl'], fontSize: fontSize.captionLg }}>
            {prompt}
          </MutedText>
        )}
      </div>
    </SlideBase>
  )
}
