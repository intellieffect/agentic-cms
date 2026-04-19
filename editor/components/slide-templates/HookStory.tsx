import { AccentBar, MutedText } from '@/components/slide-primitives'
import { fontSize, fontWeight, lineHeight, spacing, gap, layout } from '@/lib/studio/slide-tokens'
import { DEFAULT_COLORS, SlideBase, type BaseSlideStyleProps } from './SlideBase'

export interface HookStoryProps extends BaseSlideStyleProps {
  titleFontSize?: number
  opening: string
  body: string
  transition: string
}

export const hookStoryDefaultProps: HookStoryProps = {
  opening: '6개월 전까지만 해도',
  body: '저는 인스타그램 콘텐츠 하나 만드는 데\n이틀씩 걸렸습니다.\n\n디자이너 없이, 마케팅 팀 없이,\n대표 혼자 모든 걸 해야 했으니까요.',
  transition: '그런데 지금은 30분이면 끝납니다.',
  ...DEFAULT_COLORS,
}

export function HookStory({ opening, body, transition, titleFontSize, ...colors }: HookStoryProps) {
  return (
    <SlideBase {...colors}>
      <div style={{ paddingLeft: spacing.safeX, paddingRight: spacing.safeX, paddingTop: spacing.safeY, paddingBottom: spacing.safeY }}>
        <p style={{ fontSize: titleFontSize ?? fontSize.hookMd, fontWeight: fontWeight.bold, lineHeight: lineHeight.default, color: colors.textColor ?? '#fff', maxWidth: layout.maxWidth.content }}>
          {opening}
        </p>
        <AccentBar variant="defaultRound" accentColor={colors.accentColor} accentColorEnd={colors.accentColorEnd} style={{ marginTop: gap['4xl'], marginBottom: gap['4xl'] }} />
        <p style={{ fontSize: fontSize.bodyLg, fontWeight: fontWeight.normal, lineHeight: lineHeight.body, color: 'rgba(255,255,255,0.75)', whiteSpace: 'pre-line', maxWidth: layout.maxWidth.content }}>
          {body}
        </p>
        <MutedText size="lg" mutedColor={colors.accentColor} style={{ marginTop: gap['5xl'], fontSize: fontSize.subHeading, fontWeight: fontWeight.semibold, ...(colors.accentColorEnd ? { background: `linear-gradient(90deg, ${colors.accentColor}, ${colors.accentColorEnd})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : {}) }}>
          {transition}
        </MutedText>
      </div>
    </SlideBase>
  )
}
