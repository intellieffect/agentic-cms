import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverGlassProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  backgroundImageUrl?: string
}

export const coverGlassDefaultProps: CoverGlassProps = {
  title: '디자인 없이도\n콘텐츠는 만들 수 있다',
  subtitle: '구조만 잡으면 나머지는 자동화',
  ...DEFAULT_COLORS,
}

export function CoverGlass({ title, subtitle, backgroundImageUrl, titleFontSize, subtitleFontSize, ...colors }: CoverGlassProps) {
  return (
    <SlideBase {...colors}>
      {backgroundImageUrl && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          <img src={backgroundImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        </div>
      )}
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 32,
            padding: '64px 48px',
          }}
        >
          <SlideTitle variant="hero" style={{ fontSize: titleFontSize ?? fontSize.coverSm, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
            {title}
          </SlideTitle>
          <MutedText size="lg" mutedColor={colors.textColor} style={{ marginTop: gap['4xl'], fontSize: subtitleFontSize ?? fontSize.subtitleLg, opacity: 0.8, lineHeight: lineHeight.subtitle }}>
            {subtitle}
          </MutedText>
        </div>
      </div>
    </SlideBase>
  )
}
