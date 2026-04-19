import { AccentBar } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout, accentOpacity, textOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface HookVSProps extends BaseSlideStyleProps {
  titleFontSize?: number
  topLabel: string
  bottomLabel: string
  vsText?: string
  // Style overrides
  labelFontSize?: number
  vsFontSize?: number
  showAccentBar?: boolean
  barWidth?: number
  paddingX?: number
}

export const hookVSDefaultProps: HookVSProps = {
  topLabel: '제로샷',
  bottomLabel: '에이전틱 워크플로우',
  ...DEFAULT_COLORS,
}

export function HookVS({
  topLabel, bottomLabel, vsText,
  labelFontSize, vsFontSize, showAccentBar, barWidth, paddingX,
  titleFontSize, ...colors
}: HookVSProps) {
  const px = paddingX ?? spacing.safeX
  const lblSize = labelFontSize ?? fontSize.hookXl
  const vsSize = vsFontSize ?? fontSize.displayXl

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: px, paddingRight: px, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Top label */}
        <p style={{
          fontSize: titleFontSize ?? lblSize,
          fontWeight: fontWeight.bold,
          lineHeight: lineHeight.default,
          color: textOpacity.primary,
          maxWidth: layout.maxWidth.content,
        }}>
          {topLabel}
        </p>

        {/* VS hero */}
        <div style={{ marginTop: gap['5xl'], marginBottom: gap['5xl'], display: 'flex', flexDirection: 'column', alignItems: 'center', gap: gap.lg }}>
          {(showAccentBar ?? true) && (
            <AccentBar
              variant="narrow"
              accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}
              opacity={accentOpacity.mid}
              style={{ width: barWidth ?? 120, height: 3, borderRadius: 9999 }}
            />
          )}
          <p style={{
            fontSize: vsSize,
            fontWeight: fontWeight.black,
            lineHeight: lineHeight.none,
            ...gradientTextStyle(colors.accentColor, colors.accentColorEnd),
          }}>
            {vsText ?? 'VS'}
          </p>
          {(showAccentBar ?? true) && (
            <AccentBar
              variant="narrow"
              accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}
              opacity={accentOpacity.mid}
              style={{ width: barWidth ?? 120, height: 3, borderRadius: 9999 }}
            />
          )}
        </div>

        {/* Bottom label */}
        <p style={{
          fontSize: lblSize,
          fontWeight: fontWeight.bold,
          lineHeight: lineHeight.default,
          color: textOpacity.primary,
          maxWidth: layout.maxWidth.content,
        }}>
          {bottomLabel}
        </p>
      </div>
    </SlideBase>
  )
}
