import { AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, borderRadius, borderColor, cardBackground } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTATestimonialProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  quote: string
  author: string
  role: string
  cta: string
}

export const ctaTestimonialDefaultProps: CTATestimonialProps = {
  quote: '캐러셀 자동화 도입 후\n콘텐츠 제작 시간이 80% 줄었습니다.\n이제는 전략에만 집중할 수 있어요.',
  author: '김민수',
  role: 'IT 스타트업 대표',
  cta: '다음은 당신의 차례입니다 →',
  ...DEFAULT_COLORS,
}

export function CTATestimonial({ quote, author, role, cta, titleFontSize, bodyFontSize, ...colors }: CTATestimonialProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        {/* Quote card */}
        <div style={{ padding: '48px 40px', background: cardBackground.light, border: `1px solid ${borderColor.light}`, borderRadius: borderRadius.xl, borderLeft: `4px solid ${accent}`, borderImage: colors.accentColorEnd ? `linear-gradient(to bottom, ${accent}, ${colors.accentColorEnd}) 1` : undefined, overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: -24, left: -8, fontSize: 60, fontWeight: fontWeight.black, lineHeight: 1, ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${accent}88, ${colors.accentColorEnd}88)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: `${accent}88` }) }}>{'\u201C'}</span>
            <p style={{ fontSize: titleFontSize ?? fontSize.subHeading, fontWeight: fontWeight.medium, lineHeight: lineHeight.body, color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-line', paddingTop: gap['3xl'] }}>
              {quote}
            </p>
            <span style={{ fontSize: 60, fontWeight: fontWeight.black, lineHeight: 1, display: 'block', ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${accent}88, ${colors.accentColorEnd}88)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: `${accent}88` }), marginTop: gap.sm, textAlign: 'right' }}>{'\u201D'}</span>
          </div>
          <AccentBar variant="thin" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['3xl'], marginBottom: gap['3xl'], opacity: 0.5 }} />
          <div>
            <p style={{ fontSize: bodyFontSize ?? fontSize.bodySm, fontWeight: fontWeight.bold, color: colors.textColor ?? '#fff' }}>{author}</p>
            <p style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.normal, color: 'rgba(255,255,255,0.6)', marginTop: gap.xs }}>{role}</p>
          </div>
        </div>
        {/* CTA */}
        <MutedText size="lg" mutedColor={accent} style={{ marginTop: gap['5xl'], fontSize: fontSize.subHeading, fontWeight: fontWeight.bold, textAlign: 'center', ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}) }}>
          {cta}
        </MutedText>
      </div>
    </SlideBase>
  )
}
