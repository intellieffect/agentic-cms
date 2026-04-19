import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderRadius } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface BodyDosDontsProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  dos: string[]
  donts: string[]
}

export const bodyDosDontsDefaultProps: BodyDosDontsProps = {
  title: '캐러셀 디자인 가이드',
  dos: ['한 슬라이드에 한 메시지', '강조색은 1~2개만', '여백을 충분히 활용'],
  donts: ['텍스트로 가득 채우기', '5가지 색상 동시 사용', '작은 폰트 사이즈'],
  ...DEFAULT_COLORS,
}

export function BodyDosDonts({ title, dos, donts, titleFontSize, bodyFontSize, ...colors }: BodyDosDontsProps) {
  const itemSize = bodyFontSize ?? fontSize.bodySm
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, marginBottom: gap['4xl'] }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gap['3xl'] }}>
          {/* Do */}
          <div style={{ padding: spacing.cardLg, background: 'rgba(68,204,68,0.06)', border: '1px solid rgba(68,204,68,0.15)', borderRadius: borderRadius.xl }}>
            <p style={{ fontSize: fontSize.cardLabel, fontWeight: fontWeight.bold, color: '#44cc44', marginBottom: gap.lg }}>✅ DO</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: gap.md }}>
              {(dos || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: gap.sm }}>
                  <span style={{ color: '#44cc44', fontSize: itemSize, flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: itemSize, lineHeight: lineHeight.relaxed, color: 'rgba(255,255,255,0.85)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Don't */}
          <div style={{ padding: spacing.cardLg, background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.15)', borderRadius: borderRadius.xl }}>
            <p style={{ fontSize: fontSize.cardLabel, fontWeight: fontWeight.bold, color: '#ff4444', marginBottom: gap.lg }}>✕ DON'T</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: gap.md }}>
              {(donts || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: gap.sm }}>
                  <span style={{ color: '#ff4444', fontSize: itemSize, flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: itemSize, lineHeight: lineHeight.relaxed, color: 'rgba(255,255,255,0.85)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideBase>
  )
}
