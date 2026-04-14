import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyMythFactProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  myth: string
  fact: string
  mythLabel?: string
  factLabel?: string
}

export const bodyMythFactDefaultProps: BodyMythFactProps = {
  myth: '해시태그를 많이 달면\n도달이 늘어난다',
  fact: '캡션 SEO와 콘텐츠 품질이\n도달의 핵심이다',
  mythLabel: 'MYTH',
  factLabel: 'FACT',
  ...DEFAULT_COLORS,
}

export function BodyMythFact({ myth, fact, mythLabel, factLabel, bodyFontSize, ...colors }: BodyMythFactProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const muted = colors.mutedColor || '#ffffff'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY, gap: gap['4xl'] }}
      >
        {/* Myth */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: gap.lg, marginBottom: gap.lg }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>✕</span>
            </div>
            <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, color: '#ef4444', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
              {mythLabel || 'MYTH'}
            </span>
          </div>
          <MutedText size="lg" mutedColor={muted} style={{ fontSize: bodyFontSize ?? fontSize.bodyMd, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const, paddingLeft: 68 }}>
            {myth}
          </MutedText>
        </div>

        {/* Divider */}
        <div style={{ height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />

        {/* Fact */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: gap.lg, marginBottom: gap.lg }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', backgroundColor: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, letterSpacing: '0.15em', ...gradientTextStyle(accent, colors.accentColorEnd), textTransform: 'uppercase' as const }}>
              {factLabel || 'FACT'}
            </span>
          </div>
          <MutedText size="lg" mutedColor={colors.textColor || '#ffffff'} style={{ fontSize: bodyFontSize ?? fontSize.bodyMd, fontWeight: fontWeight.semibold, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const, paddingLeft: 68 }}>
            {fact}
          </MutedText>
        </div>
      </div>
    </SlideBase>
  )
}
