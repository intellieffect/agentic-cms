import { Overline, SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, cardBackground } from '@/lib/studio/slide-tokens'
import type { ReactNode } from 'react'

function renderHighlight(text: string, accentColor?: string, accentColorEnd?: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const style = accentColorEnd
        ? { background: `linear-gradient(90deg, ${accentColor || '#ff6b6b'}, ${accentColorEnd})`, WebkitBackgroundClip: 'text' as const, backgroundClip: 'text' as const, color: 'transparent' }
        : { color: accentColor }
      return (
        <span key={`hl-${idx}`} style={style}>
          {part.slice(2, -2)}
        </span>
      )
    }
    return <span key={`t-${idx}`}>{part}</span>
  })
}
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverBoldProps extends BaseSlideStyleProps {
  title: string
  subtitle: string
  tag: string
  backgroundImageUrl?: string
  // Style overrides
  titleFontSize?: number
  subtitleFontSize?: number
  tagFontSize?: number
  showAccentBar?: boolean
  barWidth?: number
  paddingX?: number
}

export const coverBoldDefaultProps: CoverBoldProps = {
  title: '결과를 만드는\n콘텐츠 전략',
  subtitle: '실무에서 바로 쓰는 인스타 캐러셀 설계법',
  tag: 'BRXCE STUDIO',
  backgroundImageUrl: undefined,
  ...DEFAULT_COLORS,
}

export function CoverBold({
  title = '', subtitle = '', tag = '', backgroundImageUrl,
  titleFontSize: titleFontSizeOverride, subtitleFontSize, tagFontSize,
  showAccentBar, barWidth, paddingX,
  ...colors
}: CoverBoldProps) {
  const lineCount = (title || '').split('\n').length
  const defaultTitleSize = lineCount >= 3 ? fontSize.coverCompact : fontSize.coverMd
  const titleLineHeight = lineCount >= 3 ? lineHeight.tight : lineHeight.tighter
  const px = paddingX ?? spacing.safeX

  return (
    <SlideBase {...colors}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        {backgroundImageUrl ? (
          <img src={backgroundImageUrl} alt={title} style={{ height: "100%", width: "100%", objectFit: "cover", opacity: 0.4 }} />
        ) : (
          <div
            style={{ height: "100%", width: "100%", background:
                'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,107,53,0.16), transparent 50%), linear-gradient(140deg, #101114 0%, #17191f 55%, #0f0f10 100%)' }}
          />
        )}
      </div>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: cardBackground.overlay }} />
      <div
        style={{ position: "relative", zIndex: 10, display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: px, paddingRight: px, paddingTop: px, paddingBottom: px * 0.5 }}
      >
        <Overline variant="tag" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd} style={{ marginBottom: gap['3xl'], ...(tagFontSize != null ? { fontSize: tagFontSize } : {}) }}>
          {tag}
        </Overline>
        <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
          variant="hero"
          style={{ fontSize: titleFontSizeOverride ?? defaultTitleSize, lineHeight: titleLineHeight, fontWeight: fontWeight.black }}
        >
          {(title || '').includes('**') ? renderHighlight(title || '', colors.accentColor, colors.accentColorEnd) : title}
        </SlideTitle>
        {(showAccentBar ?? true) && (
          <AccentBar variant="wide" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['3xl'], ...(barWidth != null ? { width: barWidth } : {}) }} />
        )}
        <MutedText
          size="lg"
          mutedColor={colors.textColor}
          style={{
            marginTop: gap['3xl'],
            fontSize: subtitleFontSize ?? fontSize.subtitleLg,
            fontWeight: fontWeight.medium,
            lineHeight: lineHeight.subtitle,
            color: '#ffffff',
          }}
        >
          {(subtitle || '').includes('**') ? renderHighlight(subtitle || '', colors.accentColor, colors.accentColorEnd) : subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
