import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderRadius, borderColor, cardBackground } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyGrowthProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  items: { label: string; before: number; after: number; unit?: string }[]
  cardWidth?: number
}

export const bodyGrowthDefaultProps: BodyGrowthProps = {
  title: '3개월 성과 비교',
  items: [
    { label: '팔로워', before: 120, after: 1282 },
    { label: '최고 댓글', before: 5, after: 361 },
    { label: '레슨 신청', before: 0, after: 22 },
  ],
  ...DEFAULT_COLORS,
}

function formatGrowth(before: number, after: number, unit?: string): { text: string; isPositive: boolean } {
  const diff = after - before
  const isPositive = diff >= 0
  const sign = isPositive ? '+' : ''

  if (before === 0) {
    switch (unit) {
      case 'percent': return { text: `${sign}${after}%`, isPositive }
      case 'won': return { text: `${sign}₩${after.toLocaleString()}`, isPositive }
      default: return { text: `${sign}${after.toLocaleString()}`, isPositive }
    }
  }

  const pct = Math.round((diff / before) * 100)

  switch (unit) {
    case 'percent':
      return { text: `${sign}${pct}%`, isPositive }
    case 'won':
      return { text: `${sign}₩${Math.abs(diff).toLocaleString()}`, isPositive }
    default:
      return { text: `${sign}${Math.abs(diff).toLocaleString()}`, isPositive }
  }
}

function formatValue(val: number): string {
  return val.toLocaleString()
}

export function BodyGrowth({ title, items, titleFontSize, bodyFontSize, cardWidth, ...colors }: BodyGrowthProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  const parsedItems = Array.isArray(items)
    ? (items || []).map((item) => {
        if (typeof item === 'string') return { label: item, before: 0, after: 0, unit: 'none' }
        return {
          label: item.label ?? '',
          before: Number(item.before) || 0,
          after: Number(item.after) || 0,
          unit: item.unit ?? 'none',
        }
      })
    : []

  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, marginBottom: gap['5xl'] }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.xl, ...(cardWidth != null ? { width: cardWidth } : {}) }}>
          {parsedItems.map((item, i) => {
            const growth = formatGrowth(item.before, item.after, item.unit)
            return (
              <div key={i} style={{ padding: '28px 32px', background: cardBackground.light, border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.xl }}>
                {/* Label + Growth badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: gap.lg }}>
                  <span style={{ fontSize: bodyFontSize ?? fontSize.bodySm, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.9)' }}>{item.label}</span>
                  <span style={{
                    fontSize: fontSize.captionLg,
                    fontWeight: fontWeight.bold,
                    color: growth.isPositive ? '#44cc44' : '#ff4444',
                    background: growth.isPositive ? 'rgba(68,204,68,0.12)' : 'rgba(255,68,68,0.12)',
                    padding: '4px 16px',
                    borderRadius: borderRadius.full,
                  }}>
                    {growth.text}
                  </span>
                </div>
                {/* Before → After */}
                <div style={{ display: 'flex', alignItems: 'center', gap: gap.lg }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: fontSize.captionMd, color: 'rgba(255,255,255,0.45)', marginBottom: gap.xs }}>BEFORE</p>
                    <p style={{ fontSize: fontSize.subHeading, fontWeight: fontWeight.medium, color: 'rgba(255,255,255,0.5)' }}>{formatValue(item.before)}</p>
                  </div>
                  <span style={{ fontSize: fontSize.bodyMd, ...gradientTextStyle(accent, colors.accentColorEnd) }}>→</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: fontSize.captionMd, color: 'rgba(255,255,255,0.45)', marginBottom: gap.xs }}>AFTER</p>
                    <p style={{ fontSize: fontSize.subHeading, fontWeight: fontWeight.bold, ...gradientTextStyle(accent, colors.accentColorEnd) }}>{formatValue(item.after)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SlideBase>
  )
}
