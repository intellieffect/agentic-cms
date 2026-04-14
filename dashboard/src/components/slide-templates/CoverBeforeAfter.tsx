import { Overline } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CoverBeforeAfterProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  beforeText: string
  afterText: string
  tag?: string
  subtitle?: string
}

export const coverBeforeAfterDefaultProps: CoverBeforeAfterProps = {
  beforeText: '매일 3시간\n반복 작업',
  afterText: '에이전트가\n대신 처리',
  tag: 'BEFORE → AFTER',
  subtitle: '스와이프해서 변화를 확인하세요',
  ...DEFAULT_COLORS,
}

export function CoverBeforeAfter({ beforeText, afterText, tag, subtitle, titleFontSize, subtitleFontSize, ...colors }: CoverBeforeAfterProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const muted = colors.mutedColor || '#ffffff'

  return (
    <SlideBase {...colors}>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", position: 'relative' }}>
        {/* Tag at top */}
        {tag && (
          <div style={{ position: 'absolute', top: spacing.safeY, left: 0, right: 0, zIndex: 10, textAlign: 'center' as const }}>
            <Overline variant="tag" accentColor={accent} accentColorEnd={colors.accentColorEnd}>
              {tag}
            </Overline>
          </div>
        )}

        {/* Top half - BEFORE (dark, muted) */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: spacing.safeX,
            paddingRight: spacing.safeX,
            position: 'relative',
          }}
        >
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, color: `${muted}`, letterSpacing: '0.2em', marginBottom: gap.lg }}>
            BEFORE
          </span>
          <div
            style={{
              fontSize: titleFontSize ?? fontSize.coverCompact,
              fontWeight: fontWeight.black,
              lineHeight: lineHeight.tight,
              color: `${muted}`,
              whiteSpace: 'pre-line' as const,
              textDecoration: 'line-through',
              textDecorationColor: `${muted}`,
              textDecorationThickness: 3,
            }}
          >
            {beforeText}
          </div>
        </div>

        {/* Divider line */}
        <div style={{ height: 3, background: colors.accentColorEnd ? `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})` : accent, position: 'relative', zIndex: 5 }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', backgroundColor: colors.backgroundColor || '#0a0a0a', padding: '4px 24px', borderRadius: 20 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </div>
        </div>

        {/* Bottom half - AFTER (highlighted) */}
        <div
          style={{
            flex: 1,
            backgroundColor: `${accent}08`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: spacing.safeX,
            paddingRight: spacing.safeX,
          }}
        >
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, letterSpacing: '0.2em', ...gradientTextStyle(accent, colors.accentColorEnd), marginBottom: gap.lg }}>
            AFTER
          </span>
          <div
            style={{
              fontSize: fontSize.coverCompact,
              fontWeight: fontWeight.black,
              lineHeight: lineHeight.tight,
              color: colors.textColor || '#ffffff',
              whiteSpace: 'pre-line' as const,
            }}
          >
            {afterText}
          </div>

          {subtitle && (
            <div style={{ marginTop: gap['2xl'], fontSize: subtitleFontSize ?? fontSize.bodySm, color: `${muted}` }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </SlideBase>
  )
}
