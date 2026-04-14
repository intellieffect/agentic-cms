import { MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyNumberedProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  number: string
  title: string
  body: string
  totalLabel?: string
}

export const bodyNumberedDefaultProps: BodyNumberedProps = {
  number: '03',
  title: '하나의 슬라이드에\n하나의 포인트만',
  body: '정보가 많으면 전달력이 떨어집니다.\n슬라이드당 핵심 메시지 하나에 집중하세요.\n나머지는 다음 장에서.',
  totalLabel: '/07',
  ...DEFAULT_COLORS,
}

export function BodyNumbered({ number, title, body, totalLabel, titleFontSize, bodyFontSize, ...colors }: BodyNumberedProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Big number */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 160, fontWeight: fontWeight.black, lineHeight: '0.85', ...gradientTextStyle(accent, colors.accentColorEnd) }}>
            {number}
          </span>
          {totalLabel && (
            <span style={{ fontSize: fontSize.subtitleLg, fontWeight: fontWeight.bold, ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${accent}50, ${colors.accentColorEnd}50)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: `${accent}50` }) }}>
              {totalLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ marginTop: gap['2xl'], fontSize: titleFontSize ?? fontSize.headingLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, color: colors.textColor || '#ffffff', whiteSpace: 'pre-line' as const }}>
          {renderMarkdownBold(title, accent)}
        </div>

        {/* Body */}
        <MutedText size="lg" mutedColor={colors.mutedColor || '#ffffff'} style={{ marginTop: gap.xl, fontSize: bodyFontSize ?? fontSize.bodyMd, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const }}>
          {renderMarkdownBold(body, accent)}
        </MutedText>
      </div>
    </SlideBase>
  )
}
