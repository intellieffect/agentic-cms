import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, gap, spacing, textOpacity } from '@/lib/studio/slide-tokens'
import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTAQuestionProps extends BaseSlideStyleProps {
  titleFontSize?: number
  question: string
  guide: string
  prompt: string
  // Style overrides
  questionFontSize?: number
  guideFontSize?: number
  promptFontSize?: number
  padding?: number
}

export const ctaQuestionDefaultProps: CTAQuestionProps = {
  question: '여러분의 콘텐츠 제작\n가장 큰 고민은 무엇인가요?',
  guide: '댓글로 남겨주시면 다음 템플릿에서 다뤄드릴게요.',
  prompt: '#댓글로_고민_남기기',
  ...DEFAULT_COLORS,
}

export function CTAQuestion({
  question, guide, prompt,
  questionFontSize, guideFontSize, promptFontSize, padding: paddingOverride,
  ...colors
}: CTAQuestionProps) {
  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="title"
          style={{ fontSize: questionFontSize ?? fontSize.ctaLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
        >
          {renderMarkdownBold(question, colors.accentColor, colors.accentColorEnd)}
        </SlideTitle>
        <MutedText size="md" mutedColor={textOpacity.tertiary} style={{ marginTop: gap['4xl'], fontSize: guideFontSize ?? fontSize.captionLg }}>
          {renderMarkdownBold(guide, colors.accentColor, colors.accentColorEnd)}
        </MutedText>
        <MutedText
          size="lg"
          mutedColor={colors.accentColor} style={{ ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${colors.accentColor}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}), marginTop: gap['5xl'], fontSize: promptFontSize ?? fontSize.bodyMd, fontWeight: fontWeight.semibold }}
        >
          {prompt}
        </MutedText>
      </div>
    </SlideBase>
  )
}
