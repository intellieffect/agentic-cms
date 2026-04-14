import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface HookSwipeBaitProps extends BaseSlideStyleProps {
  title: string
  blurredHint: string
  swipeText: string
  titleFontSize?: number
}

export const hookSwipeBaitDefaultProps: HookSwipeBaitProps = {
  title: '이 한 가지를 바꿨더니\n전환율이 3배 올랐습니다',
  blurredHint: '정답은 다음 슬라이드에',
  swipeText: '스와이프해서 확인하세요 →',
  ...DEFAULT_COLORS,
}

export function HookSwipeBait({ title, blurredHint, swipeText, titleFontSize, ...colors }: HookSwipeBaitProps) {
  const accent = colors.accentColor || '#ff6b6b'
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: colors.textAlign || 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <SlideTitle variant="hero" style={{ fontSize: titleFontSize ?? fontSize.hookMd, fontWeight: fontWeight.bold }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{
          marginTop: gap['4xl'], padding: '24px 40px', borderRadius: 16,
          background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
          fontSize: fontSize.bodyLg, color: '#ffffff', fontWeight: fontWeight.medium,
          filter: 'blur(6px)', userSelect: 'none',
        }}>
          {blurredHint}
        </div>
        <div style={{ marginTop: gap['3xl'], fontSize: fontSize.bodySm, fontWeight: fontWeight.semibold, ...gradientTextStyle(accent, colors.accentColorEnd), letterSpacing: '0.05em' }}>
          {swipeText}
        </div>
      </div>
    </SlideBase>
  )
}
