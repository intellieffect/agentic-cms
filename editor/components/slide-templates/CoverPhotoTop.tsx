import { SlideTitle, AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, ImagePlaceholder, SlideBase, type BaseSlideStyleProps } from './SlideBase'
import { gradientTextStyle } from './SlideBase'

export interface CoverPhotoTopProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  imageUrl?: string
  tag?: string
}

export const coverPhotoTopDefaultProps: CoverPhotoTopProps = {
  title: '이미지와 텍스트의\n완벽한 조합',
  subtitle: '상단 이미지로 시선을 끌고\n하단 텍스트로 메시지를 전달합니다',
  imageUrl: undefined,
  tag: 'BRXCE STUDIO',
  ...DEFAULT_COLORS,
}

export function CoverPhotoTop({ title, subtitle, imageUrl, tag, titleFontSize, subtitleFontSize, ...colors }: CoverPhotoTopProps) {
  const accent = colors.accentColor || '#ff6b6b'
  return (
    <SlideBase {...colors} centerContent={false}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Top: Photo area (55%) */}
        <div style={{ flex: '0 0 55%', overflow: 'hidden', position: 'relative' }}>
          {imageUrl ? (
            <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ImagePlaceholder label="상단 이미지" />
          )}
          {/* Gradient fade */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
            background: `linear-gradient(transparent, ${colors.backgroundColor || '#0a0a0a'})`,
          }} />
        </div>
        {/* Bottom: Text (45%) */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingBottom: spacing.safeY,
        }}>
          {tag && (
            <div style={{
              fontSize: 20, fontWeight: fontWeight.bold, letterSpacing: '0.18em',
              textTransform: 'uppercase', ...gradientTextStyle(accent, colors.accentColorEnd), marginBottom: gap.xl,
            }}>
              {tag}
            </div>
          )}
          <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.black, lineHeight: lineHeight.tight }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
            {title}
          </SlideTitle>
          <AccentBar variant="narrow" accentColor={accent} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap.xl, width: 80 }} />
          <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap.xl, fontSize: subtitleFontSize ?? fontSize.bodyMd }}>
            {subtitle}
          </MutedText>
        </div>
      </div>
    </SlideBase>
  )
}
