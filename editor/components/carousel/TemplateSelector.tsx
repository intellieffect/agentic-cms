'use client'

import { CAROUSEL_TEMPLATES, type CarouselTemplateId } from './types'
import { useCarouselStore } from './carousel-store'

const TEMPLATE_ICONS: Record<CarouselTemplateId, string> = {
  CardNews: '📰',
  StepByStep: '📋',
  BeforeAfter: '🔄',
  ListCarousel: '📊',
  QuoteCarousel: '💬',
}

export default function TemplateSelector() {
  const template = useCarouselStore((s) => s.template)
  const setTemplate = useCarouselStore((s) => s.setTemplate)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>템플릿</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {CAROUSEL_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplate(t.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 6px',
              borderRadius: 8,
              border: template === t.id ? '2px solid #FF6B35' : '2px solid transparent',
              background: template === t.id ? 'rgba(255,107,53,0.1)' : '#111',
              color: template === t.id ? '#fafafa' : '#888',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 500,
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 20 }}>{TEMPLATE_ICONS[t.id]}</span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
