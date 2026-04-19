import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

type ActionItem = string | { label: string; value?: string }

export interface CTACarouselEndProps extends BaseSlideStyleProps {
  title: string
  subtitle: string
  actions: ActionItem[]
  titleFontSize?: number
}

// Tenant-specific CTA 값은 env 에서 주입. NEXT_PUBLIC_CONTACT_EMAIL + NEXT_PUBLIC_CONTACT_DOMAIN.
// 값이 없으면 label 만 표시 (value 비어있음) — 브랜딩이 튀지 않도록.
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || ''
const contactDomain = process.env.NEXT_PUBLIC_CONTACT_DOMAIN || ''

export const ctaCarouselEndDefaultProps: CTACarouselEndProps = {
  title: '끝까지 본 당신,\n이미 상위 5%',
  subtitle: '이제 행동할 차례입니다',
  actions: [
    { label: '도입 상담 신청하기', value: contactEmail },
    { label: '사례 더 보기', value: contactDomain },
  ],
  ...DEFAULT_COLORS,
}

export function CTACarouselEnd({ title, subtitle, actions, titleFontSize, ...colors }: CTACarouselEndProps) {
  const accent = colors.accentColor || '#ff6b6b'
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: colors.textAlign || 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <div style={{ fontSize: 64, marginBottom: gap['2xl'] }}>🏆</div>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.black }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['2xl'], fontSize: fontSize.bodyMd }}>
          {subtitle}
        </MutedText>
        <div style={{ marginTop: gap['4xl'], display: 'flex', flexDirection: 'column', gap: gap.xl, width: '100%', maxWidth: 700 }}>
          {(actions || []).map((action, idx) => {
            const label = typeof action === 'string' ? action : action?.label || ''
            const value = typeof action === 'object' && action?.value ? action.value : null
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: gap.lg,
                background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px',
              }}>
                <span style={{ fontSize: 20, fontWeight: fontWeight.bold, ...gradientTextStyle(accent, colors.accentColorEnd) }}>{idx + 1}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: fontSize.bodySm, color: '#ffffff', fontWeight: fontWeight.medium }}>{label}</span>
                  {value && (
                    <div style={{ fontSize: fontSize.bodySm * 0.75, marginTop: 4, ...gradientTextStyle(accent, colors.accentColorEnd), fontWeight: fontWeight.medium }}>
                      {value}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SlideBase>
  )
}
