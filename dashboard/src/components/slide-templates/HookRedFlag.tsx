import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookRedFlagProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  redFlags: string[]
  greenFlags: string[]
}

export const hookRedFlagDefaultProps: HookRedFlagProps = {
  title: '콘텐츠 외주 체크리스트',
  redFlags: ['소통 없이 결과물만 전달', '수정 1회만 포함', '포트폴리오에 우리 업종 없음'],
  greenFlags: ['주간 미팅 포함', '무제한 수정', '업종 경험 보유'],
  ...DEFAULT_COLORS,
}

export function HookRedFlag({ title, redFlags, greenFlags, titleFontSize, bodyFontSize, ...colors }: HookRedFlagProps) {
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
          {/* Red flags */}
          <div>
            <p style={{ fontSize: fontSize.cardLabel, fontWeight: fontWeight.bold, color: '#ff4444', marginBottom: gap.lg }}>🚩 Red Flag</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: gap.md }}>
              {(redFlags || []).map((flag, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: gap.sm, padding: '16px 20px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 16 }}>
                  <span style={{ fontSize: itemSize, lineHeight: lineHeight.none, flexShrink: 0 }}>✕</span>
                  <span style={{ fontSize: itemSize, lineHeight: lineHeight.relaxed, color: 'rgba(255,255,255,0.85)' }}>{flag}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Green flags */}
          <div>
            <p style={{ fontSize: fontSize.cardLabel, fontWeight: fontWeight.bold, color: '#44cc44', marginBottom: gap.lg }}>✅ Green Flag</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: gap.md }}>
              {(greenFlags || []).map((flag, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: gap.sm, padding: '16px 20px', background: 'rgba(68,204,68,0.1)', border: '1px solid rgba(68,204,68,0.2)', borderRadius: 16 }}>
                  <span style={{ fontSize: itemSize, lineHeight: lineHeight.none, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: itemSize, lineHeight: lineHeight.relaxed, color: 'rgba(255,255,255,0.85)' }}>{flag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideBase>
  )
}
