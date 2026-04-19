import { SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, accentOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, ImagePlaceholder, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverSplitProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  imageUrl?: string
}

export const coverSplitDefaultProps: CoverSplitProps = {
  title: '데이터로 보는\n콘텐츠 성장법',
  subtitle: '감이 아닌 기준으로 운영하세요',
  imageUrl: undefined,
  ...DEFAULT_COLORS,
}

export function CoverSplit({ title, subtitle, imageUrl, titleFontSize, subtitleFontSize, ...colors }: CoverSplitProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ display: "grid", height: "100%", gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ height: "100%" }}>
          {imageUrl ? <img src={imageUrl} alt={title} style={{ height: "100%", width: "100%", objectFit: "cover" }} /> : <ImagePlaceholder label="좌측 이미지" />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
          <AccentBar
            variant="narrow"
            accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd}
            opacity={accentOpacity.full}
            style={{ width: 96, height: 8, borderRadius: 0, marginBottom: gap['3xl'] }}
          />
          <SlideTitle
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
            variant="hero"
            style={{ fontSize: titleFontSize ?? fontSize.coverSplit, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
          >
            {title}
          </SlideTitle>
          <MutedText size="lg" mutedColor={colors.textColor || "#ffffff"} style={{ marginTop: gap["3xl"], fontSize: subtitleFontSize ?? fontSize.bodyMd }}>
            {subtitle}
          </MutedText>
        </div>
      </div>
    </SlideBase>
  )
}
