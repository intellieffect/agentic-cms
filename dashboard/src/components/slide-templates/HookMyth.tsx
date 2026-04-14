import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookMythProps extends BaseSlideStyleProps {
  titleFontSize?: number
  myth: string
  reveal: string
  label?: string
}

export const hookMythDefaultProps: HookMythProps = {
  myth: '다들 해시태그가\n핵심이라고 하죠',
  reveal: '사실은 캡션 첫 줄이\n도달의 80%를 결정합니다',
  label: '흔한 착각',
  ...DEFAULT_COLORS,
}

export function HookMyth({ myth, reveal, label, titleFontSize, ...colors }: HookMythProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const muted = colors.mutedColor || '#ffffff'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {label && (
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              backgroundColor: '#ef444420',
              borderRadius: 12,
              padding: `${gap.sm}px ${gap.lg}px`,
              marginBottom: gap['2xl'],
            }}
          >
            <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, color: '#ef4444', letterSpacing: '0.1em' }}>
              {label}
            </span>
          </div>
        )}

        {/* Myth - crossed out feel */}
        <div
          style={{
            fontSize: titleFontSize ?? fontSize.hookMd,
            fontWeight: fontWeight.bold,
            lineHeight: lineHeight.default,
            color: muted,
            whiteSpace: 'pre-line' as const,
            textDecoration: 'line-through',
            textDecorationColor: muted,
            textDecorationThickness: 3,
          }}
        >
          {myth}
        </div>

        {/* Divider */}
        <div style={{ width: 60, height: 3, background: colors.accentColorEnd ? `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})` : accent, borderRadius: 2, marginTop: gap['3xl'], marginBottom: gap['3xl'] }} />

        {/* Reveal */}
        <MutedText size="lg" mutedColor={colors.textColor || '#ffffff'} style={{ fontSize: fontSize.bodyLg, fontWeight: fontWeight.semibold, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const }}>
          {reveal}
        </MutedText>
      </div>
    </SlideBase>
  )
}
