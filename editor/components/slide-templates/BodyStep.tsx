import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { SlideTitle, NumberBadge, SlideCard, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface BodyStepProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  steps: ({ title: string; desc: string } | string)[]
}

export const bodyStepDefaultProps: BodyStepProps = {
  title: '3단계 제작 프로세스',
  steps: [
    { title: 'Hook', desc: '문제/질문으로 관심 확보' },
    { title: 'Proof', desc: '데이터/사례로 신뢰 형성' },
    { title: 'CTA', desc: '저장/팔로우/댓글 행동 유도' },
  ],
  ...DEFAULT_COLORS,
}

export function BodyStep({ title, steps, titleFontSize, bodyFontSize, ...colors }: BodyStepProps) {
  const normalizedSteps = (steps || []).map((step) => (typeof step === 'string' ? { title: step, desc: '' } : step))

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingBottom: spacing.bottomLg, paddingTop: spacing.topMd }}
      >
        <SlideTitle variant="title" style={titleFontSize ? { fontSize: titleFontSize } : undefined}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {renderMarkdownBold(title, colors.accentColor)}
        </SlideTitle>
        <div style={{ marginTop: gap['3xl'], display: 'flex', flexDirection: 'column', gap: gap['2xl'] }}>
          {normalizedSteps.map((step, idx) => (
            <SlideCard
              key={`step-${idx}-${step.title || ''}`}
              variant="stepCard"
              style={{ display: 'flex', alignItems: 'center', gap: gap.xl, paddingLeft: spacing.cardMdH, paddingRight: spacing.cardMdH, paddingTop: spacing.cardMdV, paddingBottom: spacing.cardMdV }}
            >
              <NumberBadge size="lg" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}>
                {idx + 1}
              </NumberBadge>
              <div>
                <MutedText
                  size="lg"
                  mutedColor={colors.textColor}
                  style={{ fontSize: bodyFontSize ?? fontSize.cardTitle, fontWeight: fontWeight.semibold, lineHeight: lineHeight.default }}
                >
                  {step.title}
                </MutedText>
                <MutedText
                  size="md"
                  mutedColor={colors.mutedColor}
                  style={{ marginTop: gap.xs, fontSize: bodyFontSize ?? fontSize.bodyXs, lineHeight: lineHeight.relaxed }}
                >
                  {step.desc}
                </MutedText>
              </div>
            </SlideCard>
          ))}
        </div>
      </div>
    </SlideBase>
  )
}
