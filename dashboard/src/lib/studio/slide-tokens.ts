/**
 * Slide Design Tokens
 *
 * Single source of truth for all hardcoded values across 19 slide templates.
 * Extracted from: CoverBold, CoverCentered, CoverGradient, CoverMinimal, CoverSplit,
 * HookProblem, HookQuestion, HookStat, HookTeaser,
 * BodyCompare, BodyDiagram, BodyList, BodyQuote, BodyStep, BodyText,
 * CTAFollow, CTALink, CTAQuestion, CTASave, and SlideBase.
 *
 * All values are in pixels (matching 1080x1350 canvas, inline styles).
 */

import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/** Fixed slide canvas dimensions (3:4 ratio) */
export const canvas = {
  width: 1080,
  height: 1350,
} as const

// ---------------------------------------------------------------------------
// Typography — fontSize
// ---------------------------------------------------------------------------

/**
 * Font size tokens in px.
 * Named by semantic role, not arbitrary scale.
 *
 * Sources (template → field):
 *   displayXl  220  HookStat.statValue
 *   displayLg  190  BodyQuote.quoteMark
 *   coverXl    100  CoverGradient.title
 *   coverLg     98  CoverCentered.title
 *   hookXl      96  HookQuestion.question
 *   coverMd     94  CoverBold.title (≤2 lines)
 *   hookLg      90  HookTeaser.title
 *   coverSm     86  CoverMinimal.title
 *   ctaXl       84  CTASave.title
 *   hookMd      82  HookProblem.title
 *   coverCompact 80 CoverBold.title (≥3 lines)
 *   coverSplit   78 CoverSplit.title
 *   ctaLg       74  CTAQuestion.question
 *   ctaMd       72  CTALink.title
 *   ctaSm       68  CTAFollow.title
 *   headingLg   66  BodyDiagram.title, BodyCompare.title
 *   headingSm   64  HookStat.statLabel
 *   heading     62  BodyText.heading, BodyList.title, BodyStep.title
 *   buttonLg    60  CTAFollow.button
 *   subtitleLg  56  CoverBold.subtitle, BodyQuote.text
 *   emojiLg     52  BodyCompare.emoji
 *   subtitleMd  48  CTALink.linkValue (text-5xl)
 *   cardTitle   46  BodyStep.stepTitle
 *   subHeading  44  HookQuestion.subQuestion, HookStat.detail
 *   cardLabel   42  BodyCompare.cardTitle
 *   bodyLg      38  BodyText.body, CoverBold.tag
 *   bodyMd      36  (text-4xl) subtitle, points, teaser, list items, compare desc
 *   bodySm      34  BodyCompare.items, CTAFollow.hint/reason
 *   bodyXs      32  BodyStep.desc, SlideBase.slideNumber
 *   captionLg   30  (text-3xl) overline, node, tip, caption, author, badge, branding
 *   captionMd   24  (text-2xl) kicker, issue
 *   captionSm   20  (text-xl) link-label
 */
export const fontSize = {
  displayXl: 220,
  displayLg: 190,
  coverXl: 100,
  coverLg: 98,
  hookXl: 96,
  coverMd: 94,
  hookLg: 90,
  coverSm: 86,
  ctaXl: 84,
  hookMd: 82,
  coverCompact: 80,
  coverSplit: 78,
  ctaLg: 74,
  ctaMd: 72,
  ctaSm: 68,
  headingLg: 66,
  headingSm: 64,
  heading: 62,
  buttonLg: 60,
  subtitleLg: 56,
  emojiLg: 52,
  subtitleMd: 48,
  cardTitle: 46,
  subHeading: 44,
  cardLabel: 42,
  bodyLg: 38,
  bodyMd: 36,
  bodySm: 34,
  bodyXs: 32,
  captionLg: 30,
  captionMd: 24,
  captionSm: 20,
} as const

// ---------------------------------------------------------------------------
// Typography — fontWeight
// ---------------------------------------------------------------------------

/**
 * Font weight tokens.
 *
 * Sources:
 *   black     900  stat-value, title-gradient, title-bold, quote-mark, number badges, follow-button
 *   extrabold 800  HookQuestion.question
 *   bold      700  most titles and headings
 *   semibold  600  CoverMinimal.title, CoverBold.tag, HookStat.statLabel, step-title, quote-text, link-value, prompt
 *   medium    500  CoverBold.subtitle
 *   normal    400  body text, details
 */
export const fontWeight = {
  black: 900,
  extrabold: 800,
  bold: 700,
  semibold: 600,
  medium: 500,
  normal: 400,
} as const

// ---------------------------------------------------------------------------
// Typography — lineHeight
// ---------------------------------------------------------------------------

/**
 * Line height tokens (unitless multipliers).
 *
 * Sources:
 *   none       1      HookStat.statValue, BodyQuote.quoteMark (leading-none)
 *   tightest   0.95   CoverGradient.title (leading-[0.95])
 *   tighter    0.98   CoverBold.title 2-line (leading-[0.98])
 *   tight      1.02   CoverBold.title 3+ line (leading-[1.02])
 *   snug       1.18   CTAFollow.title (leading-[1.18])
 *   quote      1.23   BodyQuote.text (leading-[1.23])
 *   default    1.25   Tailwind leading-tight — most titles
 *   subtitle   1.3    CoverBold.subtitle (leading-[1.3])
 *   listItem   1.35   BodyList.item (leading-[1.35])
 *   relaxed    1.625  Tailwind leading-relaxed — details, reason
 *   body       1.7    BodyText.body (leading-[1.7])
 */
export const lineHeight = {
  none: 1,
  tightest: 0.95,
  tighter: 0.98,
  tight: 1.02,
  snug: 1.18,
  quote: 1.23,
  default: 1.25,
  subtitle: 1.3,
  listItem: 1.35,
  relaxed: 1.625,
  body: 1.7,
} as const

// ---------------------------------------------------------------------------
// Typography — letterSpacing
// ---------------------------------------------------------------------------

/**
 * Letter spacing tokens.
 *
 * Sources:
 *   branding    0.38em  SlideBase branding text
 *   kicker      0.3em   CoverCentered.kicker
 *   linkLabel   0.25em  CTALink.linkLabel
 *   badge       0.22em  HookStat.badge
 *   slideNumber 0.2em   SlideBase slide number
 *   tag         0.04em  CoverBold.tag
 */
export const letterSpacing = {
  branding: '0.38em',
  kicker: '0.3em',
  linkLabel: '0.25em',
  badge: '0.22em',
  slideNumber: '0.2em',
  tag: '0.04em',
} as const

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

/**
 * Spacing tokens in px (padding, margin, gap).
 *
 * Container padding:
 *   containerLg  80  p-20  — CoverCentered, CoverMinimal, CoverGradient, HookProblem, HookTeaser, CTASave, CTALink, CTAQuestion
 *   containerMd  64  p-16  — CoverSplit content area
 *   containerSm  56  px-14 / py-14 — BodyQuote card inner
 *
 * Asymmetric vertical:
 *   topSm    48  pt-12  — CTAFollow
 *   topMd    56  pt-14  — HookStat, BodyText, BodyCompare, BodyList, BodyStep
 *   bottomLg 96  pb-24  — BodyText, BodyCompare, BodyList, BodyStep, CTAFollow, HookStat
 *   bottomXl 112 pb-28  — CoverMinimal
 *
 * Component inner:
 *   cardLg   40  p-10  — BodyCompare cards
 *   cardMdH  32  px-8  — BodyStep card, CTALink box
 *   cardMdV  28  py-7  — BodyStep card
 *   cardSmH  24  px-6  — BodyList item, BodyDiagram node
 *   cardSmV  20  py-5  — BodyList item, BodyDiagram node
 *   cardLinkV 24 py-6  — CTALink box
 *
 * Badge/button:
 *   badgeH   48  px-12 — HookStat badge
 *   badgeV   16  py-4  — HookStat badge
 *   buttonH  64  px-16 — CTAFollow button
 *   buttonV  32  py-8  — CTAFollow button
 */
export const spacing = {
  /** Safe zone for Instagram 3:4→4:5 crop. Horizontal safe area (px). */
  safeX: 70,
  /** Safe zone for Instagram 3:4→4:5 crop. Vertical safe area / footer height (px). */
  safeY: 90,
  containerLg: 80,
  containerMd: 64,
  containerSm: 56,
  topSm: 48,
  topMd: 56,
  bottomLg: 96,
  bottomXl: 112,
  cardLg: 40,
  cardMdH: 32,
  cardMdV: 28,
  cardSmH: 24,
  cardSmV: 20,
  cardLinkV: 24,
  badgeH: 48,
  badgeV: 16,
  buttonH: 64,
  buttonV: 32,
  quoteH: 56,
  quoteV: 64,
} as const

/**
 * Gap/margin tokens in px.
 * Used for mt-*, mb-*, gap-*, space-y-* values.
 *
 * Sources:
 *   xs    8   mt-2, gap-2
 *   sm   12   mt-3, gap-3  — BodyDiagram, BodyCompare title/bullet
 *   md   16   mt-4, space-y-4  — CTAFollow hint, BodyCompare items
 *   lg   20   mt-5, gap-5  — BodyCompare content, HookProblem points
 *   xl   24   gap-6        — BodyStep, BodyList, BodyStep card
 *   2xl  28   space-y-7    — HookProblem points
 *   3xl  32   mt-8, gap-8  — various mt-8, BodyCompare grid, HookStat detail
 *   4xl  40   mt-10, space-y-10  — subtitle margins, accent bar margins, CoverMinimal content
 *   5xl  48   mt-12        — accent bar centered, prompt, teaser, link box, follow button
 *   6xl  56   mt-14        — HookProblem points container, author
 *   7xl  64   mt-16        — BodyText body
 *   8xl  80   mt-20        — HookQuestion subQuestion
 *   9xl  96   mt-24        — BodyDiagram nodes
 */
export const gap = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 56,
  '7xl': 64,
  '8xl': 80,
  '9xl': 96,
} as const

// ---------------------------------------------------------------------------
// Accent Bar (decorative dividers)
// ---------------------------------------------------------------------------

/**
 * Accent bar variants — thin horizontal dividers used across templates.
 *
 * Sources:
 *   thin          3×160  rounded  HookStat divider
 *   defaultFlat   4×160  flat     CoverCentered accent bar (h-1 w-40)
 *   defaultRound  4×112  rounded  BodyText, BodyList accent bar (h-[4px] w-28)
 *   medium        4×144  flat     CoverMinimal accent bar (h-1 w-36)
 *   wide          4×176  rounded  CoverBold accent bar (h-[4px] w-44)
 *   thick         8×96   flat     CoverSplit accent bar (h-2 w-24)
 */
export const accentBar = {
  thin: { height: 3, width: 160, borderRadius: 9999 },
  defaultFlat: { height: 4, width: 160, borderRadius: 0 },
  defaultRound: { height: 4, width: 112, borderRadius: 9999 },
  medium: { height: 4, width: 144, borderRadius: 0 },
  wide: { height: 4, width: 176, borderRadius: 9999 },
  thick: { height: 8, width: 96, borderRadius: 0 },
} as const

// ---------------------------------------------------------------------------
// Bullet dots
// ---------------------------------------------------------------------------

/**
 * Bullet dot sizes for list-style indicators.
 *
 * Sources:
 *   sm  12×12  BodyCompare item dots (h-3 w-3)
 *   md  16×16  HookProblem point dots (h-4 w-4)
 */
export const bullet = {
  sm: { size: 12, borderRadius: 9999 },
  md: { size: 16, borderRadius: 9999 },
} as const

// ---------------------------------------------------------------------------
// Number Badge (circular numbered indicators)
// ---------------------------------------------------------------------------

/**
 * Circular numbered badge variants.
 *
 * Sources:
 *   sm  56×56   fontSize 30  fontWeight 900  BodyList item numbers (h-14 w-14)
 *   lg  96×96   fontSize 36  fontWeight 900  BodyStep step numbers (h-24 w-24)
 */
export const numberBadge = {
  sm: { size: 56, fontSize: 30, borderRadius: 9999, fontWeight: 900 as const },
  lg: { size: 96, fontSize: 36, borderRadius: 9999, fontWeight: 900 as const },
} as const

// ---------------------------------------------------------------------------
// Card — border, background, radius
// ---------------------------------------------------------------------------

/**
 * Border radius tokens in px.
 *
 * Sources:
 *   md     12  rounded-xl   — BodyDiagram node
 *   lg     16  rounded-2xl  — BodyList item, CTALink box
 *   xl     24  rounded-3xl  — BodyStep card, BodyCompare card, HookStat badge
 *   quote  36  rounded-[36px] — BodyQuote card
 *   full   9999  rounded-full — bullets, badges, follow button
 */
export const borderRadius = {
  md: 12,
  lg: 16,
  xl: 24,
  quote: 36,
  full: 9999,
} as const

/**
 * Border color tokens (white at various opacities).
 *
 * Sources:
 *   subtle  white/10  — BodyList item (border-white/10)
 *   light   white/12  — BodyStep, BodyCompare, BodyQuote cards (border-white/12)
 *   medium  white/15  — BodyDiagram node, HookStat badge (border-white/15)
 *   strong  white/30  — SlideBase ImagePlaceholder (border-white/30)
 */
export const borderColor = {
  subtle: 'rgba(255, 255, 255, 0.10)',
  light: 'rgba(255, 255, 255, 0.12)',
  medium: 'rgba(255, 255, 255, 0.15)',
  strong: 'rgba(255, 255, 255, 0.30)',
} as const

/**
 * Background color tokens for card surfaces.
 *
 * Sources:
 *   subtle    white/3%   — BodyList item (bg-white/[0.03])
 *   light     white/4%   — BodyStep, BodyCompare, BodyQuote cards (bg-white/[0.04])
 *   medium    white/5%   — SlideBase ImagePlaceholder (bg-white/5)
 *   overlay   black/60%  — CoverBold background overlay (bg-black/60)
 */
export const cardBackground = {
  subtle: 'rgba(255, 255, 255, 0.03)',
  light: 'rgba(255, 255, 255, 0.04)',
  medium: 'rgba(255, 255, 255, 0.05)',
  overlay: 'rgba(0, 0, 0, 0)',
} as const

// ---------------------------------------------------------------------------
// Text opacity
// ---------------------------------------------------------------------------

/**
 * White text at various opacity levels.
 * Used for hierarchical text emphasis.
 *
 * Sources:
 *   full        white/98%  — CoverBold.subtitle (text-white/98)
 *   primary     white/90%  — BodyCompare.beforeTitle (text-white/90)
 *   branding    white/88%  — SlideBase branding text (text-white/88)
 *   secondary   white/85%  — CoverGradient.subtitle, CTASave.subtitle (text-white/85)
 *   tertiary    white/80%  — CoverCentered.subtitle, HookTeaser.teaser, CTAQuestion.guide (text-white/80)
 *   slideNumber white/78%  — SlideBase slide number (text-white/78)
 *   muted       white/70%  — HookStat badge text (text-white/70)
 *   placeholder white/60%  — SlideBase ImagePlaceholder (text-white/60)
 */
export const textOpacity = {
  full: 'rgba(255, 255, 255, 0.98)',
  primary: 'rgba(255, 255, 255, 0.90)',
  branding: 'rgba(255, 255, 255, 0.88)',
  secondary: 'rgba(255, 255, 255, 0.85)',
  tertiary: 'rgba(255, 255, 255, 0.80)',
  slideNumber: 'rgba(255, 255, 255, 0.78)',
  muted: 'rgba(255, 255, 255, 0.70)',
  placeholder: 'rgba(255, 255, 255, 0.60)',
} as const

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

/**
 * Box shadow tokens.
 *
 * Sources:
 *   followButton  CTAFollow.button — shadow-[0_12px_35px_rgba(255,107,53,0.5)]
 */
export const shadow = {
  followButton: '0 12px 35px rgba(255, 107, 53, 0.5)',
} as const

// ---------------------------------------------------------------------------
// Layout constraints
// ---------------------------------------------------------------------------

/**
 * Max-width / min-width / min-height constraints used in templates.
 *
 * Sources:
 *   maxWidth.subtitle    760  CoverMinimal.subtitle (max-w-[760px])
 *   maxWidth.content     900  HookQuestion, HookStat, CTAFollow (max-w-[900px])
 *   maxWidth.title       920  CTAFollow.title (max-w-[920px])
 *   minWidth.diagramNode 180  BodyDiagram node (min-w-[180px])
 *   minHeight.compareCard 520 BodyCompare card (min-h-[520px])
 */
export const layout = {
  maxWidth: {
    subtitle: 760,
    content: 900,
    title: 920,
  },
  minWidth: {
    diagramNode: 180,
  },
  minHeight: {
    compareCard: 520,
  },
} as const

// ---------------------------------------------------------------------------
// Branding overlay (SlideBase fixed elements)
// ---------------------------------------------------------------------------

/**
 * SlideBase overlay and branding element positions/styles.
 *
 * Sources (all from SlideBase):
 *   gradient       from-black/20 via-transparent to-black/30
 *   branding.bottom  40   (bottom-10 = 2.5rem)
 *   branding.left    64   (left-16 = 4rem)
 *   branding.fontSize 30  (text-[30px])
 *   slideNumber.bottom  40 (bottom-10)
 *   slideNumber.right   48 (right-12 = 3rem)
 *   slideNumber.fontSize 32 (text-[32px])
 */
export const overlay = {
  gradient: 'linear-gradient(to bottom, rgba(0,0,0,0.20), transparent, rgba(0,0,0,0.30))',
  branding: {
    bottom: 40,
    left: 64,
    fontSize: 30,
    letterSpacing: '0.38em',
    color: 'rgba(255, 255, 255, 0.88)',
  },
  slideNumber: {
    bottom: 40,
    right: 48,
    fontSize: 32,
    letterSpacing: '0.2em',
    color: 'rgba(255, 255, 255, 0.78)',
  },
} as const

// ---------------------------------------------------------------------------
// Accent color opacity suffixes
// ---------------------------------------------------------------------------

/**
 * Hex opacity suffixes commonly appended to the accent color.
 * Usage: `${accentColor}${accentOpacity.high}` → e.g. "#ff6b6bcc"
 *
 * Sources:
 *   full  ''    100% — most accent uses
 *   high  'cc'  80%  — CoverBold accent bar, BodyText accent bar
 *   mid   'b3'  70%  — HookStat divider
 *   muted 'c7'  78%  — BodyList accent bar
 *   light '99'  60%  — BodyCompare after-card border
 *   bg    '55'  33%  — CoverGradient radial gradient
 *   bgLight '33' 20% — BodyCompare after-card background
 *   text  'dd'  87%  — BodyQuote quote marks
 *   hint  'ee'  93%  — CTAFollow hint text
 */
export const accentOpacity = {
  full: '',
  high: 'cc',
  mid: 'b3',
  muted: 'c7',
  light: '99',
  bg: '55',
  bgLight: '33',
  text: 'dd',
  hint: 'ee',
} as const

// ---------------------------------------------------------------------------
// Aggregated token object
// ---------------------------------------------------------------------------

/** All slide tokens in a single namespace */
export const slideTokens = {
  canvas,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  spacing,
  gap,
  accentBar,
  bullet,
  numberBadge,
  borderRadius,
  borderColor,
  cardBackground,
  textOpacity,
  shadow,
  layout,
  overlay,
  accentOpacity,
} as const

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type FontSize = keyof typeof fontSize
export type FontWeight = keyof typeof fontWeight
export type LineHeight = keyof typeof lineHeight
export type LetterSpacing = keyof typeof letterSpacing
export type GapSize = keyof typeof gap
export type AccentBarVariant = keyof typeof accentBar
export type BulletSize = keyof typeof bullet
export type NumberBadgeSize = keyof typeof numberBadge
export type BorderRadiusSize = keyof typeof borderRadius
export type TextOpacityLevel = keyof typeof textOpacity
export type AccentOpacityLevel = keyof typeof accentOpacity

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge multiple CSSProperties objects into one.
 * Falsy values are filtered out for conditional styling.
 *
 * @example
 *   tokenStyle(
 *     textStyle('heading', 'bold', 'default'),
 *     { color: accentColor },
 *     isActive && { opacity: 1 },
 *   )
 */
export function tokenStyle(
  ...styles: (CSSProperties | undefined | null | false)[]
): CSSProperties {
  const result: CSSProperties = {}
  for (const s of styles) {
    if (s) Object.assign(result, s)
  }
  return result
}

/**
 * Build a CSSProperties object for text styling from token keys.
 *
 * @example
 *   <p style={textStyle('heading', 'bold', 'default')}>Title</p>
 *   // → { fontSize: 62, fontWeight: 700, lineHeight: 1.25 }
 */
export function textStyle(
  size: FontSize,
  weight?: FontWeight,
  leading?: LineHeight,
): CSSProperties {
  const style: CSSProperties = { fontSize: fontSize[size] }
  if (weight) style.fontWeight = fontWeight[weight]
  if (leading) style.lineHeight = lineHeight[leading]
  return style
}

/**
 * Build a CSSProperties object for an accent bar from a variant key.
 *
 * @param variant  One of the accentBar variant keys
 * @param color    The accent color (with optional opacity suffix)
 *
 * @example
 *   <div style={accentBarStyle('defaultRound', `${accentColor}cc`)} />
 */
export function accentBarStyle(
  variant: AccentBarVariant,
  color: string,
): CSSProperties {
  const bar = accentBar[variant]
  return {
    height: bar.height,
    width: bar.width,
    borderRadius: bar.borderRadius,
    backgroundColor: color,
  }
}

/**
 * Build a CSSProperties object for a number badge.
 *
 * @param size   'sm' | 'lg'
 * @param color  Background color
 *
 * @example
 *   <span style={numberBadgeStyle('sm', accentColor)}>{idx + 1}</span>
 */
export function numberBadgeStyle(
  size: NumberBadgeSize,
  color: string,
): CSSProperties {
  const badge = numberBadge[size]
  return {
    width: badge.size,
    height: badge.size,
    borderRadius: badge.borderRadius,
    fontSize: badge.fontSize,
    fontWeight: badge.fontWeight,
    backgroundColor: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#ffffff',
  }
}

/**
 * Build a CSSProperties object for a bullet dot.
 *
 * @param size   'sm' | 'md'
 * @param color  Dot color
 *
 * @example
 *   <span style={bulletStyle('md', accentColor)} />
 */
export function bulletStyle(
  size: BulletSize,
  color: string,
): CSSProperties {
  const b = bullet[size]
  return {
    width: b.size,
    height: b.size,
    borderRadius: b.borderRadius,
    backgroundColor: color,
    display: 'block',
    flexShrink: 0,
  }
}

/**
 * Build card container styles from common card patterns found in templates.
 *
 * @param variant  Predefined card style
 *
 * Sources:
 *   diagramNode  — BodyDiagram: rounded-xl border-white/15
 *   listItem     — BodyList: rounded-2xl border-white/10 bg-white/3%
 *   stepCard     — BodyStep: rounded-3xl border-white/12 bg-white/4%
 *   compareCard  — BodyCompare before: rounded-3xl border-white/12 bg-white/4%
 *   quoteCard    — BodyQuote: rounded-[36px] border-white/12 bg-white/4%
 *   badge        — HookStat: rounded-3xl border-white/15
 *   linkBox      — CTALink: rounded-2xl
 */
export function cardStyle(
  variant: 'diagramNode' | 'listItem' | 'stepCard' | 'compareCard' | 'quoteCard' | 'badge' | 'linkBox',
): CSSProperties {
  switch (variant) {
    case 'diagramNode':
      return {
        borderRadius: borderRadius.md,
        border: `1px solid ${borderColor.medium}`,
      }
    case 'listItem':
      return {
        borderRadius: borderRadius.lg,
        border: `1px solid ${borderColor.subtle}`,
        backgroundColor: cardBackground.subtle,
      }
    case 'stepCard':
      return {
        borderRadius: borderRadius.xl,
        border: `1px solid ${borderColor.light}`,
        backgroundColor: cardBackground.light,
      }
    case 'compareCard':
      return {
        borderRadius: borderRadius.xl,
        border: `1px solid ${borderColor.light}`,
        backgroundColor: cardBackground.light,
      }
    case 'quoteCard':
      return {
        borderRadius: borderRadius.quote,
        border: `1px solid ${borderColor.light}`,
        backgroundColor: cardBackground.light,
      }
    case 'badge':
      return {
        borderRadius: borderRadius.xl,
        border: `1px solid ${borderColor.medium}`,
      }
    case 'linkBox':
      return {
        borderRadius: borderRadius.lg,
      }
  }
}
