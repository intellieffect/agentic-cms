'use client'

import { useState, useMemo } from 'react'
import { SLIDE_TEMPLATES } from '@/lib/studio/slide-templates'
import { canvas } from '@/lib/studio/slide-tokens'
import { SlideDeckThumbnail } from '@/components/carousel/SlideDeckThumbnail'
import { makeSlide, type SlideCategory } from '@/components/carousel/slide-deck'

const CATEGORIES: { key: SlideCategory | 'all'; label: string; icon: string; desc: string }[] = [
  { key: 'all', label: '전체', icon: '', desc: '' },
  { key: 'cover', label: 'Cover', icon: '', desc: '첫 장 - 시선을 사로잡는 커버' },
  { key: 'hook', label: 'Hook', icon: '', desc: '둘째 장 - 관심을 잡아두는 훅' },
  { key: 'body', label: 'Body', icon: '', desc: '본문 - 핵심 내용 전달' },
  { key: 'cta', label: 'CTA', icon: '', desc: '마지막 - 행동을 유도하는 CTA' },
]

const CATEGORY_COLORS: Record<string, string> = {
  cover: '#8B5CF6',
  hook: '#F59E0B',
  body: '#3B82F6',
  cta: '#22C55E',
}

const THUMB_SCALE = 0.16
const thumbWidth = Math.round(canvas.width * THUMB_SCALE)
const thumbHeight = Math.round(canvas.height * THUMB_SCALE)

function TemplateCard({ template }: { template: (typeof SLIDE_TEMPLATES)[number] }) {
  const dummySlide = makeSlide({
    templateId: template.id,
    category: template.category,
    label: template.name,
    content: {},
  })
  const schemaKeys = Object.keys(template.propsSchema)
  const catColor = CATEGORY_COLORS[template.category] || '#ff6b35'

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid #222',
        background: '#111',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      <div
        style={{
          width: thumbWidth,
          height: thumbHeight,
          margin: '14px auto 0',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid #1a1a1a',
        }}
      >
        <SlideDeckThumbnail slide={dummySlide} slideIndex={0} totalSlides={1} scale={THUMB_SCALE} />
      </div>
      <div style={{ padding: '10px 14px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#eee', marginBottom: 2 }}>{template.name}</div>
        <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>{template.id}</div>
        {template.description && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{template.description}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${catColor}18`, color: catColor }}>
            {template.category}
          </span>
          {schemaKeys.slice(0, 3).map((key) => (
            <span key={key} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#1a1a1a', color: '#888' }}>
              {key}
            </span>
          ))}
          {schemaKeys.length > 3 && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#1a1a1a', color: '#555' }}>
              +{schemaKeys.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function CategorySection({ category, templates }: { category: typeof CATEGORIES[number]; templates: (typeof SLIDE_TEMPLATES) }) {
  const catColor = CATEGORY_COLORS[category.key] || '#ff6b35'
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: catColor }}>{category.label}</div>
          {category.desc && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{category.desc}</div>}
        </div>
        <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{templates.length}개</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${thumbWidth + 28}px, 1fr))`, gap: 14 }}>
        {templates.map((t) => <TemplateCard key={t.id} template={t} />)}
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState<SlideCategory | 'all'>('all')

  const filtered = useMemo(() => {
    if (activeCategory === 'all') return SLIDE_TEMPLATES
    return SLIDE_TEMPLATES.filter((t) => t.category === activeCategory)
  }, [activeCategory])

  const grouped = useMemo(() => {
    return CATEGORIES.filter((c) => c.key !== 'all').map((cat) => ({
      category: cat,
      templates: SLIDE_TEMPLATES.filter((t) => t.category === cat.key),
    })).filter((g) => g.templates.length > 0)
  }, [])

  return (
    <>
      <div className="top-bar">
        <span className="top-bar-title">슬라이드 템플릿</span>
        <div className="sep" />
        <span style={{ fontSize: 12, color: '#666' }}>{SLIDE_TEMPLATES.length}개 템플릿</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key
            const color = cat.key === 'all' ? '#ff6b35' : CATEGORY_COLORS[cat.key] || '#ff6b35'
            const count = cat.key === 'all' ? SLIDE_TEMPLATES.length : SLIDE_TEMPLATES.filter((t) => t.category === cat.key).length
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 9999,
                  border: isActive ? `1px solid ${color}` : '1px solid #333',
                  background: isActive ? `${color}18` : 'transparent',
                  color: isActive ? color : '#888',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {cat.label}
                <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {activeCategory === 'all' ? (
          grouped.map((g) => (
            <CategorySection key={g.category.key} category={g.category} templates={g.templates} />
          ))
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${thumbWidth + 28}px, 1fr))`, gap: 14 }}>
            {filtered.map((t) => <TemplateCard key={t.id} template={t} />)}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 60 }}>
            해당 카테고리에 템플릿이 없습니다.
          </div>
        )}
      </div>
    </>
  )
}
