import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface CoverPhotoProps extends BaseSlideStyleProps {
  titleFontSize?: number
  subtitleFontSize?: number
  title: string
  subtitle: string
  imageUrl?: string
  overlayOpacity?: number
  tag?: string
}

export const coverPhotoDefaultProps: CoverPhotoProps = {
  title: '사진으로 시작하는\n강력한 첫인상',
  subtitle: '한 장의 이미지가 천 마디 말을 대신합니다',
  imageUrl: undefined,
  overlayOpacity: 0.55,
  tag: '',
  ...DEFAULT_COLORS,
}

export function CoverPhoto({ title, subtitle, imageUrl, overlayOpacity = 0.55, tag, titleFontSize, subtitleFontSize, ...colors }: CoverPhotoProps) {
  const accent = colors.accentColor || '#ff6b6b'
  return (
    <SlideBase {...colors} centerContent={false}>
      {/* Background image */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }} />
        )}
      </div>
      {/* Dark overlay */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `rgba(0,0,0,${overlayOpacity})` }} />
      {/* Content — bottom aligned */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        height: '100%', paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingBottom: spacing.safeY * 2, paddingTop: spacing.safeY,
      }}>
        {tag && (
          <div style={{
            fontSize: 22, fontWeight: fontWeight.bold, letterSpacing: '0.2em', ...gradientTextStyle(accent, colors.accentColorEnd),
            textTransform: 'uppercase', marginBottom: gap['2xl'],
          }}>
            {tag}
          </div>
        )}
        <SlideTitle variant="hero" style={{ fontSize: titleFontSize ?? fontSize.coverMd, fontWeight: fontWeight.black, lineHeight: lineHeight.tighter }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['2xl'], fontSize: subtitleFontSize ?? fontSize.subtitleLg }}>
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
