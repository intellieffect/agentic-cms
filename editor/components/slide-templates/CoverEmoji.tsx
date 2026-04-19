import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverEmojiProps extends BaseSlideStyleProps {
  emoji: string
  title: string
  subtitle: string
  titleFontSize?: number
  subtitleFontSize?: number
}

export const coverEmojiDefaultProps: CoverEmojiProps = {
  emoji: '🚀',
  title: '지금 바로 시작하세요',
  subtitle: '더 이상 미루지 마세요',
  ...DEFAULT_COLORS,
}

export function CoverEmoji({ emoji, title, subtitle, titleFontSize, subtitleFontSize, ...colors }: CoverEmojiProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: colors.textAlign || 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <div style={{ fontSize: 180, lineHeight: 1, marginBottom: gap['4xl'] }}>{emoji}</div>
        <SlideTitle variant="hero" style={{ fontSize: titleFontSize ?? fontSize.coverMd, fontWeight: fontWeight.black }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['2xl'], fontSize: subtitleFontSize ?? fontSize.subtitleLg }}>
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
