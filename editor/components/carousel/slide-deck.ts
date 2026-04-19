import { SLIDE_TEMPLATES, type PropSchema } from '@/lib/studio/slide-templates'

export type SlideCategory = 'cover' | 'hook' | 'body' | 'cta'

export interface SlideContent {
  title?: string
  subtitle?: string
  body?: string
  imageUrl?: string
  items?: string[]
  steps?: Array<Record<string, unknown> | string>
  [key: string]: unknown
}

export interface SlideDeckSlide {
  id: string
  templateId: string
  label: string
  category: SlideCategory
  content: SlideContent
  overrides: Record<string, unknown>
}

export interface SlideDeckProject {
  id: string
  title: string
  caption?: string
  slides: SlideDeckSlide[]
  created_at?: string
  updated_at?: string
}

export const FIELD_ALIASES: Record<string, string[]> = {
  title: ['title', 'heading', 'question', 'overline', 'eventName', 'statLabel', 'statement', 'painPoint', 'myth', 'result'],
  subtitle: ['subtitle', 'subQuestion', 'detail', 'teaser', 'caption', 'reason', 'guide', 'empathy', 'context', 'reveal', 'transition'],
  body: ['body', 'content', 'quote', 'tip', 'description'],
  imageUrl: ['imageUrl', 'backgroundImageUrl'],
  items: ['items', 'points', 'nodes', 'conditions'],
  steps: ['steps'],
}

const SKIP_KEYS = new Set(['slideNumber', 'backgroundColor', 'accentColor', 'textColor', 'mutedColor'])

export function makeSlide(partial: Partial<SlideDeckSlide> & Pick<SlideDeckSlide, 'templateId' | 'category'>): SlideDeckSlide {
  return {
    id: partial.id || `slide-${Math.random().toString(36).slice(2, 10)}`,
    label: partial.label || defaultLabelForCategory(partial.category),
    content: partial.content || {},
    overrides: partial.overrides || {},
    ...partial,
  }
}

export function defaultSlides(title = '새 캐러셀'): SlideDeckSlide[] {
  return [
    makeSlide({
      templateId: 'cover-bold',
      category: 'cover',
      label: '커버',
      content: {
        title,
        subtitle: '핵심 메시지를 한 장씩 정리하세요',
      },
    }),
    makeSlide({
      templateId: 'body-text',
      category: 'body',
      label: '본문',
      content: {
        title: '핵심 포인트',
        body: '여기에 내용을 입력하세요.',
      },
    }),
    makeSlide({
      templateId: 'cta-question',
      category: 'cta',
      label: 'CTA',
      content: {
        title: '어떤 포인트가 가장 유용했나요?',
        subtitle: '댓글로 남겨보세요',
      },
    }),
  ]
}

export function defaultLabelForCategory(category: SlideCategory) {
  switch (category) {
    case 'cover':
      return '커버'
    case 'hook':
      return '훅'
    case 'body':
      return '본문'
    case 'cta':
      return 'CTA'
  }
}

export function resolveSlideProps(slide: SlideDeckSlide, slideIndex: number, totalSlides: number) {
  const tpl = SLIDE_TEMPLATES.find((t) => t.id === slide.templateId)
  if (!tpl) return {}

  const fromContent: Record<string, unknown> = {}
  for (const [contentKey, aliases] of Object.entries(FIELD_ALIASES)) {
    const value = slide.content?.[contentKey]
    if (value === undefined || value === null) continue
    for (const alias of aliases) {
      if (alias in tpl.propsSchema) {
        fromContent[alias] = value
        break
      }
    }
  }

  // Also map content keys that directly match propsSchema (no alias needed)
  for (const key of Object.keys(tpl.propsSchema)) {
    if (key in fromContent) continue // already resolved via alias
    if (slide.content?.[key] !== undefined && slide.content[key] !== null) {
      fromContent[key] = slide.content[key]
    }
  }

  // Filter out undefined/null values from overrides to avoid overwriting defaults
  const cleanOverrides: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(slide.overrides || {})) {
    if (value !== undefined && value !== null) {
      cleanOverrides[key] = value
    }
  }

  // Schema default 값 적용 (defaultProps에 없는 속성의 기본값)
  const schemaDefaults: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(tpl.propsSchema)) {
    if (schema.default !== undefined) {
      schemaDefaults[key] = schema.default
    }
  }

  const result: Record<string, unknown> = {
    ...schemaDefaults,
    ...tpl.defaultProps,
    ...fromContent,
    ...cleanOverrides,
    slideNumber: `${slideIndex + 1}/${totalSlides}`,
  }

  // Normalize array props: convert objects to strings so React doesn't choke
  // Skip normalization for props that expect object[] (e.g. stats in BodyStatGrid)
  for (const [key, val] of Object.entries(result)) {
    if (!Array.isArray(val)) continue
    const hasObject = val.some((v: unknown) => v !== null && typeof v === 'object')
    if (!hasObject) continue
    const schemaType = tpl.propsSchema[key]?.type || ''
    if (schemaType.includes('object[]')) continue
    result[key] = val.map((v: unknown) => {
      if (typeof v === 'string' || typeof v === 'number') return v
      if (v && typeof v === 'object') {
        const obj = v as Record<string, unknown>
        // {label, detail}, {label, value}, {title, description}, {title, desc}
        const primary = obj.label ?? obj.title ?? obj.name
        const secondary = obj.detail ?? obj.value ?? obj.description ?? obj.desc
        if (primary !== undefined) {
          return secondary ? `${primary} — ${secondary}` : String(primary)
        }
        // fallback: join all string values
        const vals = Object.values(obj).filter((x) => typeof x === 'string')
        return vals.length > 0 ? vals.join(' · ') : JSON.stringify(obj)
      }
      return String(v)
    })
  }

  return result
}

export function reverseAliasMap(propsSchema: Record<string, PropSchema>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [contentKey, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (alias in propsSchema) {
        map[alias] = contentKey
      }
    }
  }
  return map
}

export function getEditableSchemaEntries(propsSchema: Record<string, PropSchema>) {
  return Object.entries(propsSchema).filter(([key]) => !SKIP_KEYS.has(key))
}

export function buildSlideFromProps(slide: SlideDeckSlide, editableProps: Record<string, unknown>) {
  const tpl = SLIDE_TEMPLATES.find((t) => t.id === slide.templateId)
  if (!tpl) return slide

  const aliasMap = reverseAliasMap(tpl.propsSchema)
  const content = { ...(slide.content || {}) }
  const overrides = { ...(slide.overrides || {}) }

  for (const [key] of Object.entries(tpl.propsSchema)) {
    if (SKIP_KEYS.has(key)) continue
    const value = editableProps[key]
    if (value === undefined) continue
    const contentKey = aliasMap[key]
    if (contentKey) {
      content[contentKey] = value
      delete overrides[key]
    } else {
      overrides[key] = value
    }
  }

  return {
    ...slide,
    content,
    overrides,
  }
}

export function getTemplateName(templateId: string) {
  return SLIDE_TEMPLATES.find((template) => template.id === templateId)?.name || templateId
}
