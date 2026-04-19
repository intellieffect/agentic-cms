import { renderMarkdownBold } from '@/lib/studio/render-markdown'
import { SlideTitle, SlideCard, BulletList } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout, textOpacity, accentOpacity } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps, gradientTextStyle } from './SlideBase'

export interface BodyCompareProps extends BaseSlideStyleProps {
  titleFontSize?: number
  bodyFontSize?: number
  title: string
  beforeTitle: string
  beforeDesc?: string
  beforeItems?: string[]
  afterTitle: string
  afterDesc?: string
  afterItems?: string[]
}

export const bodyCompareDefaultProps: BodyCompareProps = {
  title: 'Before / After',
  beforeTitle: 'Before',
  beforeDesc: '감으로 만든 콘텐츠\n성과 예측이 어려움',
  afterTitle: 'After',
  afterDesc: '구조화된 콘텐츠\n전환율과 저장률 개선',
  ...DEFAULT_COLORS,
}

function CompareContent({ desc, items, accentColor, textColor, bodyFontSize }: { desc?: string; items?: string[]; accentColor: string; textColor: string; bodyFontSize?: number }) {
  if (items?.length) {
    return (
      <BulletList
        items={items}
        dotSize="sm"
        accentColor="currentColor"
        textColor={textColor}
        itemGap={gap.md}
        style={{ marginTop: gap.lg, fontSize: bodyFontSize ?? fontSize.bodySm, lineHeight: lineHeight.relaxed }}
      />
    )
  }

  if (desc) {
    return (
      <div style={{ marginTop: gap.lg, whiteSpace: 'pre-line', fontSize: bodyFontSize ?? fontSize.bodyMd, lineHeight: lineHeight.relaxed }}>
        {desc}
      </div>
    )
  }

  return null
}

export function BodyCompare({ title, beforeTitle, beforeDesc, beforeItems, afterTitle, afterDesc, afterItems, titleFontSize, bodyFontSize, ...colors }: BodyCompareProps) {
  return (
    <SlideBase {...colors}>
      <div
        style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "center", paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingBottom: spacing.bottomLg, paddingTop: spacing.topMd }}
      >
        <SlideTitle variant="title" style={{ fontSize: titleFontSize ?? fontSize.headingLg }}
          accentColor={colors.accentColor}
          accentColorEnd={colors.accentColorEnd}
        >
          {renderMarkdownBold(title, colors.accentColor)}
        </SlideTitle>
        <div style={{ marginTop: gap['4xl'], display: 'grid', gridTemplateColumns: '1fr 1fr', gap: gap['3xl'] }}>
          <SlideCard
            variant="compareCard"
            style={{ display: 'flex', minHeight: layout.minHeight.compareCard, flexDirection: 'column', justifyContent: 'center', padding: spacing.cardLg }}
          >
            <p style={{ display: 'flex', alignItems: 'center', gap: gap.sm, fontSize: bodyFontSize ? bodyFontSize * 1.2 : fontSize.cardLabel, fontWeight: fontWeight.bold, color: textOpacity.primary }}>
              <svg width={bodyFontSize ? bodyFontSize * 0.9 : 32} height={bodyFontSize ? bodyFontSize * 0.9 : 32} viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              {beforeTitle}
            </p>
            <CompareContent desc={beforeDesc} items={beforeItems} accentColor={colors.accentColor ?? ''} textColor={colors.textColor ?? ''} bodyFontSize={bodyFontSize} />
          </SlideCard>
          <div
            style={{
              display: 'flex',
              minHeight: layout.minHeight.compareCard,
              flexDirection: 'column',
              justifyContent: 'center',
              padding: spacing.cardLg,
              backgroundColor: `${colors.accentColor}${accentOpacity.bgLight}`,
              border: `1px solid ${colors.accentColor}${accentOpacity.light}`,
              borderRadius: 24,
            }}
          >
            <p style={{ display: 'flex', alignItems: 'center', gap: gap.sm, fontSize: bodyFontSize ? bodyFontSize * 1.2 : fontSize.cardLabel, fontWeight: fontWeight.bold, ...gradientTextStyle(colors.accentColor, colors.accentColorEnd) }}>
              <svg width={bodyFontSize ? bodyFontSize * 0.9 : 32} height={bodyFontSize ? bodyFontSize * 0.9 : 32} viewBox="0 0 24 24" fill="none" stroke={colors.accentColor || '#ff6b6b'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {afterTitle}
            </p>
            <CompareContent desc={afterDesc} items={afterItems} accentColor={colors.accentColor ?? ''} textColor={colors.textColor ?? ''} bodyFontSize={bodyFontSize} />
          </div>
        </div>
      </div>
    </SlideBase>
  )
}
