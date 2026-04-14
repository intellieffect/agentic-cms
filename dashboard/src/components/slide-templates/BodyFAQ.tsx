import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderColor, cardBackground, borderRadius } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyFAQProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  question: string
  answer: string
  tag: string
}

export const bodyFAQDefaultProps: BodyFAQProps = {
  question: '캐러셀 몇 장이\n가장 효과적인가요?',
  answer: '데이터 기반으로 7~10장이 최적입니다.\n너무 짧으면 충분한 가치 전달이 어렵고,\n너무 길면 이탈률이 높아집니다.',
  tag: 'Q&A',
  ...DEFAULT_COLORS,
}

export function BodyFAQ({ question, answer, tag, titleFontSize, bodyFontSize, ...colors }: BodyFAQProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        {/* Tag */}
        <span style={{ display: 'inline-block', padding: '8px 24px', borderRadius: borderRadius.full, background: colors.accentColorEnd ? `linear-gradient(90deg, ${accent}33, ${colors.accentColorEnd}33)` : `${accent}33`, fontSize: fontSize.captionLg, ...gradientTextStyle(accent, colors.accentColorEnd), fontWeight: fontWeight.bold, letterSpacing: '0.05em' }}>
          {tag}
        </span>
        {/* Question */}
        <div style={{ marginTop: gap['4xl'], padding: '40px 36px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.xl, borderLeft: `4px solid ${accent}` }}>
          <p style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, color: colors.textColor ?? '#fff', whiteSpace: 'pre-line' }}>
            {question}
          </p>
        </div>
        {/* Answer */}
        <div style={{ marginTop: gap['3xl'], padding: '36px 36px', background: cardBackground.light, border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.xl }}>
          <p style={{ fontSize: bodyFontSize ?? fontSize.bodyMd, fontWeight: fontWeight.normal, lineHeight: lineHeight.body, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-line' }}>
            {answer}
          </p>
        </div>
      </div>
    </SlideBase>
  )
}
