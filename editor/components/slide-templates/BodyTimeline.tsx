import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyTimelineProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  items: ({ label: string; desc: string } | string)[]
}

export const bodyTimelineDefaultProps: BodyTimelineProps = {
  title: '4주 전환 로드맵',
  items: [
    { label: '1주차', desc: '새 기능만 터미널로 작업' },
    { label: '2주차', desc: '기존 수정도 시도' },
    { label: '3주차', desc: 'IDE 닫고 전 작업 진행' },
    { label: '4주차', desc: '완전 자연스러워짐' },
  ],
  ...DEFAULT_COLORS,
}

export function BodyTimeline({ title, items, titleFontSize, bodyFontSize, ...colors }: BodyTimelineProps) {
  const accent = colors.accentColor || '#ff6b6b'
  const muted = colors.mutedColor || '#ffffff'
  const text = colors.textColor || '#ffffff'

  const normalizedItems = (items || []).map((item) =>
    typeof item === 'string' ? { label: '', desc: item } : item
  )

  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}
      >
        {/* Title */}
        <div style={{ fontSize: titleFontSize ?? fontSize.headingLg, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, color: text, marginBottom: gap['3xl'] }}>
          {renderMarkdownBold(title, colors.accentColor)}
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: 36 }}>
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: 10,
              top: 12,
              bottom: 12,
              width: 3,
              backgroundColor: `${accent}30`,
              borderRadius: 2,
            }}
          />

          {normalizedItems.map((item, idx) => (
            <div
              key={`tl-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: gap.xl,
                paddingBottom: idx < normalizedItems.length - 1 ? gap['2xl'] : 0,
                position: 'relative',
              }}
            >
              {/* Dot */}
              <div
                style={{
                  position: 'absolute',
                  left: -36 + 2,
                  top: 6,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: colors.accentColorEnd ? `linear-gradient(135deg, ${accent}, ${colors.accentColorEnd})` : accent,
                  border: '3px solid rgba(10,10,10,1)',
                  boxShadow: `0 0 0 3px ${accent}40`,
                }}
              />

              {/* Content */}
              <div>
                {item.label && (
                  <span style={{ fontSize: fontSize.captionLg, fontWeight: fontWeight.bold, display: 'block', ...gradientTextStyle(accent, colors.accentColorEnd), marginBottom: gap.xs }}>
                    {item.label}
                  </span>
                )}
                <MutedText size="lg" mutedColor={text} style={{ fontSize: bodyFontSize ?? fontSize.bodyMd, fontWeight: fontWeight.medium, lineHeight: lineHeight.relaxed }}>
                  {item.desc}
                </MutedText>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideBase>
  )
}
