import { Overline, SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, cardBackground } from '@/lib/studio/slide-tokens'
import { renderBold } from '@/lib/studio/render-markdown'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CoverNumberedProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  number: string
  title: string
  subtitle: string
  tag?: string
}

export const coverNumberedDefaultProps: CoverNumberedProps = {
  number: '7',
  title: '에이전트 활용법',
  subtitle: '지금 바로 적용할 수 있는\n실전 팁 모음',
  tag: 'GUIDE',
  ...DEFAULT_COLORS,
}

export function CoverNumbered({ number, title, subtitle, tag, titleFontSize, subtitleFontSize, ...colors }: CoverNumberedProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <div
          style={{ height: "100%", width: "100%", background:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,107,53,0.16), transparent 50%), linear-gradient(140deg, #101114 0%, #17191f 55%, #0f0f10 100%)' }}
        />
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: cardBackground.overlay }} />
      <div
        style={{ position: "relative", zIndex: 10, display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {tag && (
          <Overline variant="tag" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginBottom: gap.xl }}>
            {tag}
          </Overline>
        )}

        {/* Big number + title inline */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: gap.xl }}>
          <span style={{ fontSize: 220, fontWeight: fontWeight.black, lineHeight: '0.8', ...gradientTextStyle(accent, colors.accentColorEnd) }}>
            {number}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: titleFontSize ?? fontSize.coverCompact, fontWeight: fontWeight.black, lineHeight: lineHeight.tight, color: colors.textColor || '#ffffff', whiteSpace: 'pre-line' as const }}>
              {(title || '').includes('**') ? renderBold(title || '', accent) : title}
            </div>
          </div>
        </div>

        <AccentBar variant="wide" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['2xl'] }} />

        <MutedText
          size="lg"
          mutedColor={colors.textColor || '#ffffff'}
          style={{
            marginTop: gap['2xl'],
            fontSize: subtitleFontSize ?? fontSize.subtitleLg,
            fontWeight: fontWeight.medium,
            lineHeight: lineHeight.subtitle,
            color: '#ffffff',
            whiteSpace: 'pre-line' as const,
          }}
        >
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
