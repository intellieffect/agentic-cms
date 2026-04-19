import type { CSSProperties, ReactNode } from 'react'
import { canvas, spacing } from '@/lib/studio/slide-tokens'

export interface BaseSlideStyleProps {
  backgroundColor?: string
  accentColor?: string
  accentColorEnd?: string  // 설정 시 accentColor→accentColorEnd 그라디언트
  textColor?: string
  mutedColor?: string
  slideNumber?: string
  textAlign?: 'left' | 'center' | 'right'
}

/** 그라디언트 CSS 생성 유틸. accentColorEnd가 있으면 그라디언트, 없으면 단색 */
export function accentGradientCSS(start?: string, end?: string, direction = '90deg'): string {
  if (end && start) return `linear-gradient(${direction}, ${start}, ${end})`
  return start || '#ff6b6b'
}

/** 텍스트에 그라디언트를 적용하기 위한 inline style */
export function gradientTextStyle(start?: string, end?: string): React.CSSProperties {
  if (end && start) {
    return {
      background: `linear-gradient(90deg, ${start}, ${end})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    }
  }
  return { color: start || '#ff6b6b' }
}

export const DEFAULT_COLORS = {
  backgroundColor: '#0a0a0a',
  accentColor: '#ff6b6b',
  accentColorEnd: '#ffa500',
  textColor: '#ffffff',
  mutedColor: '#e0e0e0',
}

export type FooterVariant = 'avatar' | 'minimal' | 'none'

export function SlideBase({
  children,
  backgroundColor = DEFAULT_COLORS.backgroundColor,
  textColor = DEFAULT_COLORS.textColor,
  slideNumber,
  textAlign,
  style,
  centerContent = true,
  footer = 'avatar',
}: BaseSlideStyleProps & {
  children: ReactNode
  style?: CSSProperties
  centerContent?: boolean
  footer?: FooterVariant
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: canvas.width,
        height: canvas.height,
        backgroundColor,
        color: textColor,
        textAlign: textAlign ?? 'center',
        ...style,
      }}
    >
      <div
        style={
          centerContent
            ? { display: 'flex', height: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center' }
            : { height: '100%' }
        }
      >
        {children}
      </div>
      {footer !== 'none' && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            height: spacing.safeY,
            paddingLeft: spacing.safeX,
            paddingRight: spacing.safeX,
          }}
        >
          {slideNumber && (
            <span style={{ fontSize: 24, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}>{slideNumber}</span>
          )}
          {footer === 'avatar' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
              {(process.env.NEXT_PUBLIC_BRAND_HANDLE) && (
                <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.65)' }}>{process.env.NEXT_PUBLIC_BRAND_HANDLE}</span>
              )}
              {process.env.NEXT_PUBLIC_BRAND_AVATAR_URL && (
                <img src={process.env.NEXT_PUBLIC_BRAND_AVATAR_URL} alt={process.env.NEXT_PUBLIC_BRAND_NAME || 'Brand'} style={{ height: 52, width: 52, borderRadius: '50%' }} />
              )}
            </div>
          )}
          {footer === 'minimal' && process.env.NEXT_PUBLIC_BRAND_HANDLE && (
            <span style={{ marginLeft: 'auto', fontSize: 24, letterSpacing: '0.38em', color: 'rgba(255,255,255,0.5)' }}>{process.env.NEXT_PUBLIC_BRAND_HANDLE}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function ImagePlaceholder({ label = '이미지 영역' }: { label?: string }) {
  return (
    <div style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px dashed rgba(255,255,255,0.3)',
      background: 'rgba(255,255,255,0.05)',
      fontSize: 30,
      color: 'rgba(255,255,255,0.6)',
    }}>
      {label}
    </div>
  )
}
