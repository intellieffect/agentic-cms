import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CTAShareProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  targetPerson: string
  reason?: string
  prompt?: string
}

export const ctaShareDefaultProps: CTAShareProps = {
  title: '이 사람에게\n보내주세요',
  targetPerson: 'AI로 업무 효율을 높이고 싶은\n동료나 팀장님',
  reason: '한 명이 알면 팀 전체가 바뀝니다.',
  prompt: '#공유 #에이전틱워크플로우',
  ...DEFAULT_COLORS,
}

export function CTAShare({ title, targetPerson, reason, prompt, titleFontSize, ...colors }: CTAShareProps) {
  const accent = colors.accentColor || '#ff6b6b'

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: colors.textAlign || "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Share icon */}
        <div style={{ marginBottom: gap['2xl'] }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </div>

        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.headingLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, textAlign: 'center' as const }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>

        {/* Target person card */}
        <div
          style={{
            marginTop: gap['3xl'],
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 20,
            padding: `${gap['2xl']}px ${gap['3xl']}px`,
            borderLeft: `4px solid ${accent}`,
          }}
        >
          <MutedText size="lg" mutedColor={colors.textColor || '#ffffff'} style={{ fontSize: fontSize.bodyMd, fontWeight: fontWeight.semibold, lineHeight: lineHeight.relaxed, whiteSpace: 'pre-line' as const }}>
            {targetPerson}
          </MutedText>
        </div>

        {reason && (
          <MutedText size="lg" mutedColor={colors.mutedColor || '#ffffff'} style={{ marginTop: gap['2xl'], fontSize: fontSize.bodySm, lineHeight: lineHeight.relaxed }}>
            {reason}
          </MutedText>
        )}

        {prompt && (
          <MutedText size="md" mutedColor={`${accent}80`} style={{ marginTop: gap.xl, fontSize: fontSize.captionLg }}>
            {prompt}
          </MutedText>
        )}
      </div>
    </SlideBase>
  )
}
