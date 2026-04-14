import { SlideTitle, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface CoverRedactedProps extends BaseSlideStyleProps {
  titleFontSize?: number
  title: string
  redactedWord: string
  subtitle: string
}

export const coverRedactedDefaultProps: CoverRedactedProps = {
  title: '당신이 모르는\n███ 의 비밀',
  redactedWord: '알고리즘',
  subtitle: '스와이프해서 확인하세요 →',
  ...DEFAULT_COLORS,
}

export function CoverRedacted({ title, redactedWord, subtitle, titleFontSize, ...colors }: CoverRedactedProps) {
  const accent = colors.accentColor ?? '#ff6b6b'
  const rendered = (title || '')
    .replace(/█+/g, () =>
      `<span style="background:${colors.accentColorEnd ? `linear-gradient(90deg,${accent},${colors.accentColorEnd})` : accent};color:transparent;border-radius:4px;padding:0 8px">${redactedWord}</span>`
    )
    .replace(/\*\*(.+?)\*\*/g, colors.accentColorEnd
      ? `<span style="background:linear-gradient(90deg,${accent},${colors.accentColorEnd});-webkit-background-clip:text;background-clip:text;color:transparent">$1</span>`
      : `<span style="color:${accent}">$1</span>`)

  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <div
          style={{
            fontSize: titleFontSize ?? fontSize.coverMd,
            fontWeight: fontWeight.black,
            lineHeight: lineHeight.default,
            color: colors.textColor ?? '#fff',
            maxWidth: layout.maxWidth.content,
            whiteSpace: 'pre-line',
          }}
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
        <MutedText size="lg" mutedColor={colors.accentColor} style={{ marginTop: gap['5xl'], fontSize: fontSize.subHeading, ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${accent}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}) }}>
          {subtitle}
        </MutedText>
      </div>
    </SlideBase>
  )
}
