import { SlideTitle } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookChatBubbleProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  messages: string[]
}

export const hookChatBubbleDefaultProps: HookChatBubbleProps = {
  title: '이런 대화 해본 적 있나요?',
  messages: [
    '대표님, 인스타 콘텐츠 외주 맡기면 얼마예요?',
    '건당 50만원이요. 캐러셀은 100만원이고요.',
    '...직접 만들 순 없을까요?',
  ],
  ...DEFAULT_COLORS,
}

export function HookChatBubble({ title, messages, titleFontSize, bodyFontSize, ...colors }: HookChatBubbleProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  const msgSize = bodyFontSize ?? fontSize.bodyMd
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.topMd, paddingBottom: spacing.bottomLg }}>
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.heading, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, marginBottom: gap['5xl'] }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {title}
        </SlideTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.lg }}>
          {(messages || []).map((msg, i) => {
            const isRight = i % 2 === 0
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '24px 32px',
                    borderRadius: 24,
                    borderBottomRightRadius: isRight ? 4 : 24,
                    borderBottomLeftRadius: isRight ? 24 : 4,
                    background: isRight ? (colors.accentColorEnd ? `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})` : accent) : 'rgba(255,255,255,0.08)',
                    color: isRight ? '#fff' : 'rgba(255,255,255,0.9)',
                    fontSize: msgSize,
                    fontWeight: fontWeight.medium,
                    lineHeight: lineHeight.relaxed,
                  }}
                >
                  {msg}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SlideBase>
  )
}
