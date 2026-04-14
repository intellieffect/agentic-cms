'use client'

import { useCarouselStore, getTotalSlides } from './carousel-store'
import { CardNews, StepByStep, BeforeAfter, ListCarousel, QuoteCarousel } from './templates'

export default function CarouselPreview() {
  const data = useCarouselStore((s) => s.data)
  const currentSlide = useCarouselStore((s) => s.currentSlide)
  const setCurrentSlide = useCarouselStore((s) => s.setCurrentSlide)
  const styleConfig = useCarouselStore((s) => s.styleConfig)

  const total = getTotalSlides(data)

  function renderSlide() {
    const accentColor = styleConfig.primaryColor || '#FF6B35'
    switch (data.template) {
      case 'CardNews':
        return <CardNews slideIndex={currentSlide} slides={data.slides} coverTitle={data.coverTitle} coverSubtitle={data.coverSubtitle} ctaHandle={data.ctaHandle} accentColor={accentColor} />
      case 'StepByStep':
        return <StepByStep slideIndex={currentSlide} steps={data.steps} guideTitle={data.guideTitle} guideSubtitle={data.guideSubtitle} accentColor={accentColor} />
      case 'BeforeAfter':
        return <BeforeAfter slideIndex={currentSlide} items={data.items} coverTitle={data.coverTitle} coverSubtitle={data.coverSubtitle} beforeLabel={data.beforeLabel} afterLabel={data.afterLabel} accentColor={accentColor} />
      case 'ListCarousel':
        return <ListCarousel slideIndex={currentSlide} slides={data.slides} listTitle={data.listTitle} listSubtitle={data.listSubtitle} numbered={data.numbered} accentColor={accentColor} />
      case 'QuoteCarousel':
        return <QuoteCarousel slideIndex={currentSlide} quotes={data.quotes} collectionTitle={data.collectionTitle} collectionSubtitle={data.collectionSubtitle} accentColor={styleConfig.accentColor || '#4ECDC4'} />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flex: 1, width: '100%', minHeight: 0 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0, alignSelf: 'flex-start' }}>프리뷰</h3>

      {/* Preview container — renders at 1080x1350 then scales down */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        aspectRatio: '4/5',
        flexShrink: 0,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #222',
        position: 'relative',
      }}>
        <div
          id="carousel-preview"
          style={{
            width: 1080,
            height: 1350,
            transform: 'scale(var(--preview-scale))',
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
            backgroundColor: styleConfig.backgroundColor || '#0A0A0A',
          }}
          ref={(el) => {
            if (el && el.parentElement) {
              const parentW = el.parentElement.clientWidth
              const scale = parentW / 1080
              el.style.setProperty('--preview-scale', String(scale))
            }
          }}
        >
          {renderSlide()}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
          disabled={currentSlide <= 0}
          style={{ fontSize: 14, padding: '6px 14px', background: '#222', border: 'none', borderRadius: 6, color: '#ccc', cursor: currentSlide > 0 ? 'pointer' : 'default', opacity: currentSlide > 0 ? 1 : 0.3 }}
        >
          ◀
        </button>
        <span style={{ fontSize: 12, color: '#666' }}>{currentSlide + 1} / {total}</span>
        <button
          onClick={() => setCurrentSlide(Math.min(total - 1, currentSlide + 1))}
          disabled={currentSlide >= total - 1}
          style={{ fontSize: 14, padding: '6px 14px', background: '#222', border: 'none', borderRadius: 6, color: '#ccc', cursor: currentSlide < total - 1 ? 'pointer' : 'default', opacity: currentSlide < total - 1 ? 1 : 0.3 }}
        >
          ▶
        </button>
      </div>

      {/* Slide indicators */}
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            onClick={() => setCurrentSlide(i)}
            style={{
              width: i === currentSlide ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === currentSlide ? (styleConfig.primaryColor || '#FF6B35') : '#333',
              cursor: 'pointer',
              transition: 'all .2s',
            }}
          />
        ))}
      </div>
    </div>
  )
}
