import { Overline, SlideTitle, MutedText, AccentBar } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface HookResultProps extends BaseSlideStyleProps {
  titleFontSize?: number
  result: string
  context: string
  overline?: string
}

export const hookResultDefaultProps: HookResultProps = {
  result: '3시간 → 12분',
  context: '에이전트 도입 후\n하루 리포트 작성 시간',
  overline: 'REAL RESULT',
  ...DEFAULT_COLORS,
}

export function HookResult({ result, context, overline, titleFontSize, ...colors }: HookResultProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {overline && (
          <Overline variant="tag" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginBottom: gap['2xl'] }}>
            {overline}
          </Overline>
        )}

        {/* Big result */}
        <div
          style={{
            fontSize: titleFontSize ?? 120,
            fontWeight: fontWeight.black,
            lineHeight: lineHeight.tight,
            ...gradientTextStyle(accent, colors.accentColorEnd),
            whiteSpace: 'pre-line' as const,
          }}
        >
          {result}
        </div>

        <AccentBar variant="wide" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['2xl'] }} />

        {/* Context */}
        <MutedText
          size="lg"
          mutedColor={colors.mutedColor || '#ffffff'}
          style={{
            marginTop: gap['2xl'],
            fontSize: fontSize.bodyLg,
            fontWeight: fontWeight.medium,
            lineHeight: lineHeight.relaxed,
            whiteSpace: 'pre-line' as const,
          }}
        >
          {context}
        </MutedText>
      </div>
    </SlideBase>
  )
}
