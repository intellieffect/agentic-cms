// ==========================================
// Carousel Types for brxce-editor
// ==========================================

export interface CarouselSlide {
  id: string
  layout: 'text-only' | 'text-image' | 'quote'
  title?: string
  body?: string
  imageUrl?: string
  quoteText?: string
  quoteAuthor?: string
}

export interface StyleConfig {
  fontFamily?: string
  primaryColor?: string
  backgroundColor?: string
  accentColor?: string
  borderRadius?: number
}

export type CarouselTemplateId =
  | 'CardNews'
  | 'StepByStep'
  | 'BeforeAfter'
  | 'ListCarousel'
  | 'QuoteCarousel'

export interface CarouselTemplateInfo {
  id: CarouselTemplateId
  name: string
  description: string
  width: number
  height: number
}

export interface CarouselProject {
  id: string
  title: string
  template: CarouselTemplateId
  caption?: string
  slides: Record<string, unknown>[]
  style_config: StyleConfig
  width: number
  height: number
  created_at: string
  updated_at: string
}

// Template-specific prop types

export interface CardNewsSlide {
  title: string
  body?: string
  imageUrl?: string
}

export interface CardNewsProps {
  slideIndex: number
  slides: CardNewsSlide[]
  coverTitle: string
  coverSubtitle?: string
  ctaHandle?: string
  accentColor?: string
}

export interface Step {
  title: string
  description: string
  emoji?: string
}

export interface StepByStepProps {
  slideIndex: number
  steps: Step[]
  guideTitle: string
  guideSubtitle?: string
  accentColor?: string
}

export interface BeforeAfterItem {
  label: string
  before: string
  after: string
  emoji?: string
}

export interface BeforeAfterProps {
  slideIndex: number
  items: BeforeAfterItem[]
  coverTitle: string
  coverSubtitle?: string
  beforeLabel?: string
  afterLabel?: string
  accentColor?: string
}

export interface ListItem {
  title: string
  description?: string
  emoji?: string
}

export interface ListSlideData {
  heading?: string
  items: ListItem[]
}

export interface ListCarouselProps {
  slideIndex: number
  slides: ListSlideData[]
  listTitle: string
  listSubtitle?: string
  numbered?: boolean
  startNumber?: number
  accentColor?: string
}

export interface QuoteItem {
  text: string
  author: string
  role?: string
  emoji?: string
}

export interface QuoteCarouselProps {
  slideIndex: number
  quotes: QuoteItem[]
  collectionTitle: string
  collectionSubtitle?: string
  accentColor?: string
}

export const CAROUSEL_TEMPLATES: CarouselTemplateInfo[] = [
  { id: 'CardNews', name: '카드뉴스', description: '카드뉴스 캐러셀', width: 1080, height: 1350 },
  { id: 'StepByStep', name: '단계별 가이드', description: '단계별 설명', width: 1080, height: 1350 },
  { id: 'BeforeAfter', name: 'Before/After', description: '전후 비교', width: 1080, height: 1350 },
  { id: 'ListCarousel', name: 'Top N 리스트', description: '리스트/팁', width: 1080, height: 1350 },
  { id: 'QuoteCarousel', name: '인사이트 카드', description: '인용구/인사이트', width: 1080, height: 1350 },
]
