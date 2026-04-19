import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyStatGridProps extends BaseSlideStyleProps {
  title: string
  stats: { value: string; label: string }[]
  titleFontSize?: number
  bodyFontSize?: number
}

export const bodyStatGridDefaultProps: BodyStatGridProps = {
  title: '숫자로 보는 성과',
  stats: [
    { value: '3x', label: '전환율 증가' },
    { value: '70%', label: '시간 절감' },
    { value: '50+', label: '자동화 워크플로우' },
    { value: '0원', label: '추가 비용' },
  ],
  ...DEFAULT_COLORS,
}

export function BodyStatGrid({ title, stats, titleFontSize, bodyFontSize, ...colors }: BodyStatGridProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const items = (stats || []).slice(0, 6)
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', justifyContent: 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <SlideTitle variant="title" style={titleFontSize ? { fontSize: titleFontSize } : undefined}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{
          marginTop: gap['4xl'], display: 'grid',
          gridTemplateColumns: items.length <= 4 ? '1fr 1fr' : '1fr 1fr 1fr',
          gap: gap['2xl'],
        }}>
          {(items || []).map((stat, idx) => (
            <div key={idx} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '32px 24px',
              textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: bodyFontSize ?? 64, fontWeight: fontWeight.black, lineHeight: 1, ...gradientTextStyle(accent, colors.accentColorEnd) }}>
                {stat.value}
              </div>
              <div style={{ marginTop: gap.lg, fontSize: fontSize.bodySm, color: '#ffffff', fontWeight: fontWeight.medium }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideBase>
  )
}
