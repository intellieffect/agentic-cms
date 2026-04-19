import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CTAPollProps extends BaseSlideStyleProps {
  question: string
  options: string[]
  prompt: string
  titleFontSize?: number
}

export const ctaPollDefaultProps: CTAPollProps = {
  question: '당신은 어떤 타입인가요?',
  options: ['A. 계획형 — 치밀하게 준비', 'B. 실행형 — 일단 시작', 'C. 분석형 — 데이터 우선'],
  prompt: '댓글에 A, B, C로 답해주세요',
  ...DEFAULT_COLORS,
}

export function CTAPoll({ question, options, prompt, titleFontSize, ...colors }: CTAPollProps) {
  const accent = colors.accentColor || '#ff6b6b'
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: colors.textAlign || 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {question}
        </SlideTitle>
        <div style={{ marginTop: gap['4xl'], display: 'flex', flexDirection: 'column', gap: gap.xl, width: '100%', maxWidth: 700 }}>
          {(options || []).map((opt, idx) => (
            <div key={idx} style={{
              background: idx === 0 ? `${accent}18` : 'rgba(255,255,255,0.04)',
              border: idx === 0 ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '20px 28px', textAlign: 'left',
              fontSize: fontSize.bodyMd, fontWeight: fontWeight.semibold, color: '#ffffff',
            }}>
              {opt}
            </div>
          ))}
        </div>
        <div style={{ marginTop: gap['3xl'], fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, ...gradientTextStyle(accent, colors.accentColorEnd) }}>
          {prompt}
        </div>
      </div>
    </SlideBase>
  )
}
