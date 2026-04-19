import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, ImagePlaceholder, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface BodyPhotoProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  body: string
  imageUrl?: string
  imagePosition?: 'top' | 'bottom' | 'left' | 'right'
}

export const bodyPhotoDefaultProps: BodyPhotoProps = {
  title: '시각적 증거가\n설득력을 높입니다',
  body: '텍스트만으로는 전달하기 어려운 것들이 있습니다.\n사진 한 장이 신뢰를 만듭니다.',
  imageUrl: undefined,
  imagePosition: 'top',
  ...DEFAULT_COLORS,
}

export function BodyPhoto({ title, body, imageUrl, imagePosition = 'top', titleFontSize, bodyFontSize, ...colors }: BodyPhotoProps) {
  const isHorizontal = imagePosition === 'left' || imagePosition === 'right'
  const isReverse = imagePosition === 'bottom' || imagePosition === 'right'

  const imageEl = (
    <div style={{ flex: isHorizontal ? '0 0 45%' : '0 0 40%', overflow: 'hidden', position: 'relative' }}>
      {imageUrl ? (
        <img src={imageUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <ImagePlaceholder label="이미지" />
      )}
    </div>
  )

  const textEl = (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: `${spacing.safeY}px ${spacing.safeX}px`,
    }}>
      <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
        {title}
      </SlideTitle>
      <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['2xl'], fontSize: bodyFontSize ?? fontSize.bodyMd, lineHeight: lineHeight.body }}>
        {body}
      </MutedText>
    </div>
  )

  return (
    <SlideBase {...colors} centerContent={false}>
      <div style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        height: '100%',
      }}>
        {isReverse ? <>{textEl}{imageEl}</> : <>{imageEl}{textEl}</>}
      </div>
    </SlideBase>
  )
}
