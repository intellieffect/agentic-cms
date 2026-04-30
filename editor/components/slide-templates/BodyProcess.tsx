import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface BodyProcessProps extends BaseSlideStyleProps {
  title: string
  steps: string[]
  titleFontSize?: number
  bodyFontSize?: number
}

export const bodyProcessDefaultProps: BodyProcessProps = {
  title: '3단계 프로세스',
  steps: ['문제 정의', '솔루션 설계', '실행 & 검증'],
  ...DEFAULT_COLORS,
}

export function BodyProcess({ title, steps, titleFontSize, bodyFontSize, ...colors }: BodyProcessProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const items = (steps || []).map((s) =>
    typeof s === 'string' ? s : (s as Record<string, unknown>)?.label ? `${(s as Record<string, unknown>).label}${(s as Record<string, unknown>).detail ? ' — ' + (s as Record<string, unknown>).detail : ''}` : String(s)
  )
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', justifyContent: 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <SlideTitle variant="title" style={titleFontSize ? { fontSize: titleFontSize } : undefined}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{ marginTop: gap['4xl'], display: 'flex', flexDirection: 'column', gap: 0 }}>
          {(items || []).map((step, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: gap.xl }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: colors.accentColorEnd ? `linear-gradient(135deg, ${accent}, ${colors.accentColorEnd})` : accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: fontWeight.black, color: '#000',
                }}>
                  {idx + 1}
                </div>
                {idx < items.length - 1 && (
                  <div style={{ width: 3, height: 48, background: colors.accentColorEnd ? `linear-gradient(to bottom, ${accent}40, ${colors.accentColorEnd}40)` : `${accent}40` }} />
                )}
              </div>
              <div style={{
                flex: 1, fontSize: bodyFontSize ?? fontSize.bodyLg, fontWeight: fontWeight.semibold,
                color: '#ffffff', paddingTop: 12, paddingBottom: idx < items.length - 1 ? 48 : 12,
              }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideBase>
  )
}
