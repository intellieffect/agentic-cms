import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyBeforeAfterProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  beforeTitle: string
  beforeBody: string
  afterTitle: string
  afterBody: string
}

export const bodyBeforeAfterDefaultProps: BodyBeforeAfterProps = {
  beforeTitle: 'BEFORE',
  beforeBody: '매번 처음부터 기획\n일관성 없는 디자인\n업로드에만 30분',
  afterTitle: 'AFTER',
  afterBody: '템플릿 기반 제작\n브랜드 일관성 유지\n5분 만에 완성',
  ...DEFAULT_COLORS,
}

export function BodyBeforeAfter({ beforeTitle, beforeBody, afterTitle, afterBody, bodyFontSize, ...colors }: BodyBeforeAfterProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const muted = colors.mutedColor || '#ffffff'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY, gap: gap['3xl'] }}
      >
        {/* Before */}
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 20,
            padding: `${gap['2xl']}px ${gap['3xl']}px`,
            borderLeft: `5px solid ${muted}`,
          }}
        >
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, color: muted, letterSpacing: '0.2em' }}>
            {beforeTitle}
          </span>
          <MutedText size="lg" mutedColor={muted} style={{ fontSize: bodyFontSize ?? fontSize.bodyMd, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const, marginTop: gap.lg }}>
            {beforeBody}
          </MutedText>
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </div>

        {/* After */}
        <div
          style={{
            backgroundColor: `${accent}12`,
            borderRadius: 20,
            padding: `${gap['2xl']}px ${gap['3xl']}px`,
            borderLeft: `5px solid ${accent}`,
          }}
        >
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, letterSpacing: '0.2em', ...gradientTextStyle(accent, colors.accentColorEnd) }}>
            {afterTitle}
          </span>
          <MutedText size="lg" mutedColor={colors.textColor || '#ffffff'} style={{ fontSize: bodyFontSize ?? fontSize.bodyMd, fontWeight: fontWeight.semibold, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const, marginTop: gap.lg }}>
            {afterBody}
          </MutedText>
        </div>
      </div>
    </SlideBase>
  )
}
