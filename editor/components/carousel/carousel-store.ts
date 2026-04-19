import { create } from 'zustand'
import type { CarouselTemplateId, StyleConfig, CardNewsSlide, Step, BeforeAfterItem, ListSlideData, QuoteItem } from './types'
import { BRXCE_BRAND } from './brand'

// Generic slide data per template
export type TemplateData =
  | { template: 'CardNews'; coverTitle: string; coverSubtitle: string; ctaHandle: string; slides: CardNewsSlide[] }
  | { template: 'StepByStep'; guideTitle: string; guideSubtitle: string; steps: Step[] }
  | { template: 'BeforeAfter'; coverTitle: string; coverSubtitle: string; beforeLabel: string; afterLabel: string; items: BeforeAfterItem[] }
  | { template: 'ListCarousel'; listTitle: string; listSubtitle: string; numbered: boolean; slides: ListSlideData[] }
  | { template: 'QuoteCarousel'; collectionTitle: string; collectionSubtitle: string; quotes: QuoteItem[] }

function defaultDataForTemplate(template: CarouselTemplateId): TemplateData {
  switch (template) {
    case 'CardNews':
      return { template: 'CardNews', coverTitle: '제목을 입력하세요', coverSubtitle: '', ctaHandle: '@brxce.ai', slides: [{ title: '슬라이드 1', body: '내용을 입력하세요' }] }
    case 'StepByStep':
      return { template: 'StepByStep', guideTitle: '가이드 제목', guideSubtitle: '', steps: [{ title: 'Step 1', description: '설명을 입력하세요' }] }
    case 'BeforeAfter':
      return { template: 'BeforeAfter', coverTitle: '전후 비교', coverSubtitle: '', beforeLabel: 'BEFORE', afterLabel: 'AFTER', items: [{ label: '항목 1', before: '변경 전', after: '변경 후' }] }
    case 'ListCarousel':
      return { template: 'ListCarousel', listTitle: 'Top N 리스트', listSubtitle: '', numbered: true, slides: [{ items: [{ title: '항목 1', description: '설명' }] }] }
    case 'QuoteCarousel':
      return { template: 'QuoteCarousel', collectionTitle: '인사이트 모음', collectionSubtitle: '', quotes: [{ text: '인용문을 입력하세요', author: '저자명' }] }
  }
}

export function getTotalSlides(data: TemplateData): number {
  switch (data.template) {
    case 'CardNews': return data.slides.length + 2 // cover + content + cta
    case 'StepByStep': return data.steps.length + 1
    case 'BeforeAfter': return data.items.length + 1
    case 'ListCarousel': return data.slides.length + 1
    case 'QuoteCarousel': return data.quotes.length + 1
  }
}

interface CarouselState {
  // Project metadata
  projectId: string
  projectTitle: string
  template: CarouselTemplateId
  data: TemplateData
  styleConfig: StyleConfig

  // UI
  currentSlide: number
  saving: boolean
  dirty: boolean

  // Actions
  setTemplate: (t: CarouselTemplateId) => void
  setProjectTitle: (title: string) => void
  setData: (data: TemplateData) => void
  updateData: (patch: Partial<TemplateData>) => void
  setStyleConfig: (cfg: Partial<StyleConfig>) => void
  setCurrentSlide: (n: number) => void
  nextSlide: () => void
  prevSlide: () => void
  setSaving: (s: boolean) => void
  loadProject: (p: { id: string; title: string; template: CarouselTemplateId; data: TemplateData; styleConfig: StyleConfig }) => void
  reset: () => void
}

export const useCarouselStore = create<CarouselState>((set, get) => ({
  projectId: '',
  projectTitle: '새 캐러셀',
  template: 'CardNews',
  data: defaultDataForTemplate('CardNews'),
  styleConfig: {
    primaryColor: BRXCE_BRAND.colors.primary,
    backgroundColor: BRXCE_BRAND.colors.background,
    accentColor: BRXCE_BRAND.colors.accent,
    fontFamily: BRXCE_BRAND.fonts.headline,
  },
  currentSlide: 0,
  saving: false,
  dirty: false,

  setTemplate: (t) => set({ template: t, data: defaultDataForTemplate(t), currentSlide: 0, dirty: true }),
  setProjectTitle: (title) => set({ projectTitle: title, dirty: true }),
  setData: (data) => set({ data, dirty: true }),
  updateData: (patch) => set((s) => ({ data: { ...s.data, ...patch } as TemplateData, dirty: true })),
  setStyleConfig: (cfg) => set((s) => ({ styleConfig: { ...s.styleConfig, ...cfg }, dirty: true })),
  setCurrentSlide: (n) => set({ currentSlide: n }),
  nextSlide: () => {
    const s = get()
    const total = getTotalSlides(s.data)
    if (s.currentSlide < total - 1) set({ currentSlide: s.currentSlide + 1 })
  },
  prevSlide: () => {
    const s = get()
    if (s.currentSlide > 0) set({ currentSlide: s.currentSlide - 1 })
  },
  setSaving: (saving) => set({ saving }),
  loadProject: (p) => set({ projectId: p.id, projectTitle: p.title, template: p.template, data: p.data, styleConfig: p.styleConfig, currentSlide: 0, dirty: false }),
  reset: () => set({ projectId: '', projectTitle: '새 캐러셀', template: 'CardNews', data: defaultDataForTemplate('CardNews'), currentSlide: 0, dirty: false }),
}))
