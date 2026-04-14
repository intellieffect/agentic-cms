import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookHotTakeProps extends BaseSlideStyleProps {
  label: string
  opinion: string
  context: string
  titleFontSize?: number
}

export const hookHotTakeDefaultProps: HookHotTakeProps = {
  label: 'HOT TAKE',
  opinion: '회의는 생산성의 적이다',
  context: '반박하려면 끝까지 보세요',
  ...DEFAULT_COLORS,
}

export function HookHotTake({ label, opinion, context, titleFontSize, ...colors }: HookHotTakeProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: colors.textAlign || 'center', paddingLeft: spacing.safeX, paddingRight: spacing.safeX }}>
        <div style={{
          display: 'inline-flex', padding: '8px 24px', borderRadius: 9999,
          background: 'linear-gradient(135deg, #ef4444, #f97316)', marginBottom: gap['3xl'],
        }}>
          <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.black, color: '#fff', letterSpacing: '0.2em' }}>
            {label}
          </span>
        </div>
        <SlideTitle variant="hero" style={{ fontSize: titleFontSize ?? fontSize.hookLg, fontWeight: fontWeight.black, lineHeight: lineHeight.tighter }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {opinion}
        </SlideTitle>
        <MutedText size="lg" mutedColor="#ffffff" style={{ marginTop: gap['3xl'], fontSize: fontSize.bodyMd, fontStyle: 'italic' }}>
          {context}
        </MutedText>
      </div>
    </SlideBase>
  )
}
