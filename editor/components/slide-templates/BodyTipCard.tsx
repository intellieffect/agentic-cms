import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyTipCardProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  emoji: string
  title: string
  body: string
  tipNumber?: string
}

export const bodyTipCardDefaultProps: BodyTipCardProps = {
  emoji: '💡',
  title: '프롬프트는 구체적으로',
  body: '"좋은 코드 짜줘"보다\n"TypeScript로 JWT 인증 미들웨어 작성해줘.\nExpress 5, 에러 핸들링 포함."\n\n구체적일수록 결과가 정확합니다.',
  tipNumber: 'TIP 03',
  ...DEFAULT_COLORS,
}

export function BodyTipCard({ emoji, title, body, tipNumber, titleFontSize, bodyFontSize, ...colors }: BodyTipCardProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Tip label */}
        {tipNumber && (
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, letterSpacing: '0.2em', ...gradientTextStyle(accent, colors.accentColorEnd), marginBottom: gap['2xl'] }}>
            {tipNumber}
          </span>
        )}

        {/* Emoji */}
        <div style={{ fontSize: 80, lineHeight: 1, marginBottom: gap['2xl'] }}>
          {emoji}
        </div>

        {/* Title */}
        <div style={{ fontSize: titleFontSize ?? fontSize.headingLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, color: colors.textColor || '#ffffff', whiteSpace: 'pre-line' as const }}>
          {renderMarkdownBold(title, accent)}
        </div>

        {/* Body */}
        <MutedText size="lg" mutedColor={colors.mutedColor || '#ffffff'} style={{ marginTop: gap.xl, fontSize: bodyFontSize ?? fontSize.bodySm, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const }}>
          {renderMarkdownBold(body, accent)}
        </MutedText>
      </div>
    </SlideBase>
  )
}
