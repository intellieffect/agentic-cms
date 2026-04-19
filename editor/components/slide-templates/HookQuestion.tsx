import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookQuestionProps extends BaseSlideStyleProps {
  titleFontSize?: number
  question: string
  subQuestion: string
}

export const hookQuestionDefaultProps: HookQuestionProps = {
  question: '아직도 콘텐츠를\n감으로 만들고 계신가요?',
  subQuestion: '이제는 구조가 필요합니다.',
  ...DEFAULT_COLORS,
}

export function HookQuestion({ question, subQuestion, titleFontSize, ...colors }: HookQuestionProps) {
  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="hero"
          style={{ fontSize: titleFontSize ?? fontSize.hookXl, fontWeight: fontWeight.extrabold, lineHeight: lineHeight.default, maxWidth: layout.maxWidth.content }}
        >
          {question}
        </SlideTitle>
        <MutedText
          size="lg"
          mutedColor={colors.accentColor} style={{ ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${colors.accentColor}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}), marginTop: gap['8xl'], fontSize: fontSize.subHeading }}
        >
          {subQuestion}
        </MutedText>
      </div>
    </SlideBase>
  )
}
