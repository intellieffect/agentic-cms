import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CoverMagazineProps extends BaseSlideStyleProps {
  titleFontSize?: number
  masthead: string
  headline: string
  subHeadline: string
  issueLabel: string
}

export const coverMagazineDefaultProps: CoverMagazineProps = {
  masthead: 'BRXCE',
  headline: '콘텐츠\n자동화의\n시대',
  subHeadline: 'AI가 바꾸는 크리에이터 워크플로우',
  issueLabel: 'VOL.01 — 2026',
  ...DEFAULT_COLORS,
}

export function CoverMagazine({ masthead, headline, subHeadline, issueLabel, titleFontSize, ...colors }: CoverMagazineProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  return (
    <SlideBase {...colors} centerContent={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        {/* Masthead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: fontSize.subtitleLg, fontWeight: fontWeight.black, letterSpacing: '0.2em', ...gradientTextStyle(accent, colors.accentColorEnd) }}>{masthead}</span>
          <span style={{ fontSize: fontSize.captionMd, fontWeight: fontWeight.medium, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>{issueLabel}</span>
        </div>
        <div style={{ width: '100%', height: 2, background: colors.accentColorEnd ? `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})` : accent, marginTop: gap.md }} />
        {/* Headline */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <h1 style={{ fontSize: titleFontSize ?? 110, fontWeight: fontWeight.black, lineHeight: lineHeight.tightest, color: colors.textColor ?? '#fff', whiteSpace: 'pre-line', textTransform: 'uppercase' }}>
            {headline}
          </h1>
        </div>
        {/* Sub headline */}
        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.2)', marginBottom: gap.lg }} />
        <p style={{ fontSize: fontSize.bodyMd, fontWeight: fontWeight.medium, color: 'rgba(255,255,255,0.7)', lineHeight: lineHeight.relaxed }}>
          {subHeadline}
        </p>
      </div>
    </SlideBase>
  )
}
