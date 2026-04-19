'use client'

import { useCarouselStore, getTotalSlides, type TemplateData } from './carousel-store'

/** Generic field editor for the currently selected slide's template data. */
export default function SlideEditor() {
  const data = useCarouselStore((s) => s.data)
  const setData = useCarouselStore((s) => s.setData)
  const currentSlide = useCarouselStore((s) => s.currentSlide)

  const total = getTotalSlides(data)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#111',
    border: '1px solid #333',
    borderRadius: 6,
    padding: '8px 10px',
    color: '#eee',
    fontSize: 12,
  }
  const labelStyle: React.CSSProperties = { fontSize: 10, color: '#888', marginBottom: 2, display: 'block' }
  const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 80, resize: 'vertical' }

  // ─── CardNews ───
  if (data.template === 'CardNews') {
    const d = data
    if (currentSlide === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>커버 슬라이드</h4>
          <div><label style={labelStyle}>제목</label><input style={inputStyle} value={d.coverTitle} onChange={(e) => setData({ ...d, coverTitle: e.target.value })} /></div>
          <div><label style={labelStyle}>부제목</label><input style={inputStyle} value={d.coverSubtitle} onChange={(e) => setData({ ...d, coverSubtitle: e.target.value })} /></div>
          <div><label style={labelStyle}>CTA 핸들</label><input style={inputStyle} value={d.ctaHandle} onChange={(e) => setData({ ...d, ctaHandle: e.target.value })} /></div>
        </div>
      )
    }
    if (currentSlide === total - 1) {
      return <div style={{ color: '#666', fontSize: 11, padding: 8 }}>CTA 슬라이드 — 핸들을 커버 설정에서 변경하세요</div>
    }
    const idx = currentSlide - 1
    const slide = d.slides[idx]
    if (!slide) return null
    const updateSlide = (patch: Partial<typeof slide>) => {
      const slides = [...d.slides]
      slides[idx] = { ...slides[idx], ...patch }
      setData({ ...d, slides })
    }
    const removeSlide = () => {
      if (d.slides.length <= 1) return
      setData({ ...d, slides: d.slides.filter((_, i) => i !== idx) })
    }
    const addSlide = () => {
      setData({ ...d, slides: [...d.slides, { title: `슬라이드 ${d.slides.length + 1}`, body: '' }] })
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>슬라이드 {idx + 1}</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addSlide} style={{ fontSize: 10, padding: '3px 8px', background: '#222', border: 'none', borderRadius: 4, color: '#ccc', cursor: 'pointer' }}>+ 추가</button>
            {d.slides.length > 1 && <button onClick={removeSlide} style={{ fontSize: 10, padding: '3px 8px', background: '#300', border: 'none', borderRadius: 4, color: '#f88', cursor: 'pointer' }}>삭제</button>}
          </div>
        </div>
        <div><label style={labelStyle}>제목</label><input style={inputStyle} value={slide.title} onChange={(e) => updateSlide({ title: e.target.value })} /></div>
        <div><label style={labelStyle}>본문</label><textarea style={textareaStyle} value={slide.body || ''} onChange={(e) => updateSlide({ body: e.target.value })} /></div>
      </div>
    )
  }

  // ─── StepByStep ───
  if (data.template === 'StepByStep') {
    const d = data
    if (currentSlide === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>커버</h4>
          <div><label style={labelStyle}>제목</label><input style={inputStyle} value={d.guideTitle} onChange={(e) => setData({ ...d, guideTitle: e.target.value })} /></div>
          <div><label style={labelStyle}>부제목</label><input style={inputStyle} value={d.guideSubtitle} onChange={(e) => setData({ ...d, guideSubtitle: e.target.value })} /></div>
        </div>
      )
    }
    const idx = currentSlide - 1
    const step = d.steps[idx]
    if (!step) return null
    const updateStep = (patch: Partial<typeof step>) => {
      const steps = [...d.steps]
      steps[idx] = { ...steps[idx], ...patch }
      setData({ ...d, steps })
    }
    const addStep = () => setData({ ...d, steps: [...d.steps, { title: `Step ${d.steps.length + 1}`, description: '' }] })
    const removeStep = () => { if (d.steps.length > 1) setData({ ...d, steps: d.steps.filter((_, i) => i !== idx) }) }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>Step {idx + 1}</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addStep} style={{ fontSize: 10, padding: '3px 8px', background: '#222', border: 'none', borderRadius: 4, color: '#ccc', cursor: 'pointer' }}>+ 추가</button>
            {d.steps.length > 1 && <button onClick={removeStep} style={{ fontSize: 10, padding: '3px 8px', background: '#300', border: 'none', borderRadius: 4, color: '#f88', cursor: 'pointer' }}>삭제</button>}
          </div>
        </div>
        <div><label style={labelStyle}>이모지</label><input style={inputStyle} value={step.emoji || ''} onChange={(e) => updateStep({ emoji: e.target.value })} /></div>
        <div><label style={labelStyle}>제목</label><input style={inputStyle} value={step.title} onChange={(e) => updateStep({ title: e.target.value })} /></div>
        <div><label style={labelStyle}>설명</label><textarea style={textareaStyle} value={step.description} onChange={(e) => updateStep({ description: e.target.value })} /></div>
      </div>
    )
  }

  // ─── BeforeAfter ───
  if (data.template === 'BeforeAfter') {
    const d = data
    if (currentSlide === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>커버</h4>
          <div><label style={labelStyle}>제목</label><input style={inputStyle} value={d.coverTitle} onChange={(e) => setData({ ...d, coverTitle: e.target.value })} /></div>
          <div><label style={labelStyle}>부제목</label><input style={inputStyle} value={d.coverSubtitle} onChange={(e) => setData({ ...d, coverSubtitle: e.target.value })} /></div>
          <div><label style={labelStyle}>Before 라벨</label><input style={inputStyle} value={d.beforeLabel} onChange={(e) => setData({ ...d, beforeLabel: e.target.value })} /></div>
          <div><label style={labelStyle}>After 라벨</label><input style={inputStyle} value={d.afterLabel} onChange={(e) => setData({ ...d, afterLabel: e.target.value })} /></div>
        </div>
      )
    }
    const idx = currentSlide - 1
    const item = d.items[idx]
    if (!item) return null
    const updateItem = (patch: Partial<typeof item>) => {
      const items = [...d.items]
      items[idx] = { ...items[idx], ...patch }
      setData({ ...d, items })
    }
    const addItem = () => setData({ ...d, items: [...d.items, { label: `항목 ${d.items.length + 1}`, before: '', after: '' }] })
    const removeItem = () => { if (d.items.length > 1) setData({ ...d, items: d.items.filter((_, i) => i !== idx) }) }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>비교 {idx + 1}</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addItem} style={{ fontSize: 10, padding: '3px 8px', background: '#222', border: 'none', borderRadius: 4, color: '#ccc', cursor: 'pointer' }}>+ 추가</button>
            {d.items.length > 1 && <button onClick={removeItem} style={{ fontSize: 10, padding: '3px 8px', background: '#300', border: 'none', borderRadius: 4, color: '#f88', cursor: 'pointer' }}>삭제</button>}
          </div>
        </div>
        <div><label style={labelStyle}>라벨</label><input style={inputStyle} value={item.label} onChange={(e) => updateItem({ label: e.target.value })} /></div>
        <div><label style={labelStyle}>이모지</label><input style={inputStyle} value={item.emoji || ''} onChange={(e) => updateItem({ emoji: e.target.value })} /></div>
        <div><label style={labelStyle}>Before</label><textarea style={textareaStyle} value={item.before} onChange={(e) => updateItem({ before: e.target.value })} /></div>
        <div><label style={labelStyle}>After</label><textarea style={textareaStyle} value={item.after} onChange={(e) => updateItem({ after: e.target.value })} /></div>
      </div>
    )
  }

  // ─── ListCarousel ───
  if (data.template === 'ListCarousel') {
    const d = data
    if (currentSlide === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>커버</h4>
          <div><label style={labelStyle}>제목</label><input style={inputStyle} value={d.listTitle} onChange={(e) => setData({ ...d, listTitle: e.target.value })} /></div>
          <div><label style={labelStyle}>부제목</label><input style={inputStyle} value={d.listSubtitle} onChange={(e) => setData({ ...d, listSubtitle: e.target.value })} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={d.numbered} onChange={(e) => setData({ ...d, numbered: e.target.checked })} />
            <label style={{ fontSize: 10, color: '#888' }}>번호 매기기</label>
          </div>
        </div>
      )
    }
    const idx = currentSlide - 1
    const slide = d.slides[idx]
    if (!slide) return null
    const updateSlide = (patch: Partial<typeof slide>) => {
      const slides = [...d.slides]
      slides[idx] = { ...slides[idx], ...patch }
      setData({ ...d, slides })
    }
    const addListSlide = () => setData({ ...d, slides: [...d.slides, { items: [{ title: '새 항목' }] }] })
    const removeListSlide = () => { if (d.slides.length > 1) setData({ ...d, slides: d.slides.filter((_, i) => i !== idx) }) }
    const addItem = () => updateSlide({ items: [...slide.items, { title: `항목 ${slide.items.length + 1}` }] })
    const removeItem = (ii: number) => { if (slide.items.length > 1) updateSlide({ items: slide.items.filter((_, i) => i !== ii) }) }
    const updateItem = (ii: number, patch: Partial<typeof slide.items[0]>) => {
      const items = [...slide.items]
      items[ii] = { ...items[ii], ...patch }
      updateSlide({ items })
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>리스트 슬라이드 {idx + 1}</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addListSlide} style={{ fontSize: 10, padding: '3px 8px', background: '#222', border: 'none', borderRadius: 4, color: '#ccc', cursor: 'pointer' }}>+ 슬라이드</button>
            {d.slides.length > 1 && <button onClick={removeListSlide} style={{ fontSize: 10, padding: '3px 8px', background: '#300', border: 'none', borderRadius: 4, color: '#f88', cursor: 'pointer' }}>슬라이드 삭제</button>}
          </div>
        </div>
        <div><label style={labelStyle}>소제목</label><input style={inputStyle} value={slide.heading || ''} onChange={(e) => updateSlide({ heading: e.target.value })} /></div>
        {slide.items.map((item, ii) => (
          <div key={ii} style={{ background: '#111', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#666' }}>#{ii + 1}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={addItem} style={{ fontSize: 9, padding: '2px 6px', background: '#222', border: 'none', borderRadius: 3, color: '#ccc', cursor: 'pointer' }}>+</button>
                {slide.items.length > 1 && <button onClick={() => removeItem(ii)} style={{ fontSize: 9, padding: '2px 6px', background: '#300', border: 'none', borderRadius: 3, color: '#f88', cursor: 'pointer' }}>✕</button>}
              </div>
            </div>
            <input style={inputStyle} placeholder="제목" value={item.title} onChange={(e) => updateItem(ii, { title: e.target.value })} />
            <input style={inputStyle} placeholder="설명 (선택)" value={item.description || ''} onChange={(e) => updateItem(ii, { description: e.target.value })} />
            <input style={inputStyle} placeholder="이모지 (선택)" value={item.emoji || ''} onChange={(e) => updateItem(ii, { emoji: e.target.value })} />
          </div>
        ))}
      </div>
    )
  }

  // ─── QuoteCarousel ───
  if (data.template === 'QuoteCarousel') {
    const d = data
    if (currentSlide === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>커버</h4>
          <div><label style={labelStyle}>제목</label><input style={inputStyle} value={d.collectionTitle} onChange={(e) => setData({ ...d, collectionTitle: e.target.value })} /></div>
          <div><label style={labelStyle}>부제목</label><input style={inputStyle} value={d.collectionSubtitle} onChange={(e) => setData({ ...d, collectionSubtitle: e.target.value })} /></div>
        </div>
      )
    }
    const idx = currentSlide - 1
    const quote = d.quotes[idx]
    if (!quote) return null
    const updateQuote = (patch: Partial<typeof quote>) => {
      const quotes = [...d.quotes]
      quotes[idx] = { ...quotes[idx], ...patch }
      setData({ ...d, quotes })
    }
    const addQuote = () => setData({ ...d, quotes: [...d.quotes, { text: '인용문', author: '저자' }] })
    const removeQuote = () => { if (d.quotes.length > 1) setData({ ...d, quotes: d.quotes.filter((_, i) => i !== idx) }) }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>인용구 {idx + 1}</h4>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={addQuote} style={{ fontSize: 10, padding: '3px 8px', background: '#222', border: 'none', borderRadius: 4, color: '#ccc', cursor: 'pointer' }}>+ 추가</button>
            {d.quotes.length > 1 && <button onClick={removeQuote} style={{ fontSize: 10, padding: '3px 8px', background: '#300', border: 'none', borderRadius: 4, color: '#f88', cursor: 'pointer' }}>삭제</button>}
          </div>
        </div>
        <div><label style={labelStyle}>인용문</label><textarea style={textareaStyle} value={quote.text} onChange={(e) => updateQuote({ text: e.target.value })} /></div>
        <div><label style={labelStyle}>저자</label><input style={inputStyle} value={quote.author} onChange={(e) => updateQuote({ author: e.target.value })} /></div>
        <div><label style={labelStyle}>직함/소속</label><input style={inputStyle} value={quote.role || ''} onChange={(e) => updateQuote({ role: e.target.value })} /></div>
        <div><label style={labelStyle}>이모지</label><input style={inputStyle} value={quote.emoji || ''} onChange={(e) => updateQuote({ emoji: e.target.value })} /></div>
      </div>
    )
  }

  return null
}
