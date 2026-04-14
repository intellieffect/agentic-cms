import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookPainPointProps extends BaseSlideStyleProps {
  titleFontSize?: number
  painPoint: string
  empathy: string
  transition?: string
}

export const hookPainPointDefaultProps: HookPainPointProps = {
  painPoint: '매일 같은 작업을\n반복하고 있다면',
  empathy: '당신 잘못이 아닙니다.\n시스템이 없는 게 문제입니다.',
  transition: '',
  ...DEFAULT_COLORS,
}

export function HookPainPoint({ painPoint, empathy, transition, titleFontSize, ...colors }: HookPainPointProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const muted = colors.mutedColor || '#ffffff'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Pain point - big emotional text */}
        <div
          style={{
            fontSize: titleFontSize ?? fontSize.hookMd,
            fontWeight: fontWeight.bold,
            lineHeight: lineHeight.default,
            color: colors.textColor || '#ffffff',
            whiteSpace: 'pre-line' as const,
          }}
        >
          {painPoint}
        </div>

        {/* Empathy line */}
        {empathy && (
          <div
            style={{
              marginTop: gap['3xl'],
              borderLeft: `4px solid ${accent}`, borderImage: colors.accentColorEnd ? `linear-gradient(to bottom, ${accent}, ${colors.accentColorEnd}) 1` : undefined,
              paddingLeft: gap.xl,
            }}
          >
            <MutedText
              size="lg"
              mutedColor={muted}
              style={{
                fontSize: fontSize.bodyMd,
                fontWeight: fontWeight.medium,
                lineHeight: lineHeight.relaxed,
                whiteSpace: 'pre-line' as const,
              }}
            >
              {empathy}
            </MutedText>
          </div>
        )}

        {/* Transition CTA */}
        {transition && (
          <MutedText
            size="md"
            mutedColor={accent}
            style={{
              marginTop: gap['4xl'],
              fontSize: fontSize.bodySm,
              fontWeight: fontWeight.semibold,
              ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}),
            }}
          >
            {transition}
          </MutedText>
        )}
      </div>
    </SlideBase>
  )
}
