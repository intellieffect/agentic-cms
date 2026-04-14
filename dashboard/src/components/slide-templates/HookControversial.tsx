import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface HookControversialProps extends BaseSlideStyleProps {
  titleFontSize?: number
  statement: string
  subtext: string
}

export const hookControversialDefaultProps: HookControversialProps = {
  statement: 'IDE는\n이미 끝났다',
  subtext: '반박하려고 스와이프하셔도 됩니다.\n단, 끝까지 보고 판단하세요.',
  ...DEFAULT_COLORS,
}

export function HookControversial({ statement, subtext, titleFontSize, ...colors }: HookControversialProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Warning badge */}
        <div
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            backgroundColor: `${accent}18`,
            borderRadius: 12,
            padding: `${gap.sm}px ${gap.lg}px`,
            marginBottom: gap['3xl'],
          }}
        >
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, letterSpacing: '0.15em', ...gradientTextStyle(accent, colors.accentColorEnd) }}>
            ⚡ CONTROVERSIAL
          </span>
        </div>

        {/* Bold statement */}
        <div
          style={{
            fontSize: titleFontSize ?? fontSize.coverMd,
            fontWeight: fontWeight.black,
            lineHeight: lineHeight.tight,
            color: colors.textColor || '#ffffff',
            whiteSpace: 'pre-line' as const,
          }}
        >
          {statement}
        </div>

        {/* Subtext */}
        <MutedText
          size="lg"
          mutedColor={colors.mutedColor || '#ffffff'}
          style={{
            marginTop: gap['3xl'],
            fontSize: fontSize.bodySm,
            lineHeight: lineHeight.relaxed,
            whiteSpace: 'pre-line' as const,
          }}
        >
          {subtext}
        </MutedText>
      </div>
    </SlideBase>
  )
}
