'use client'

import { useCarouselStore } from './carousel-store'

const COLOR_PRESETS = [
  { label: '오렌지', primary: '#FF6B35', accent: '#4ECDC4' },
  { label: '블루', primary: '#3B82F6', accent: '#F59E0B' },
  { label: '퍼플', primary: '#8B5CF6', accent: '#EC4899' },
  { label: '그린', primary: '#10B981', accent: '#F97316' },
  { label: '레드', primary: '#EF4444', accent: '#6366F1' },
]

export default function StylePanel() {
  const styleConfig = useCarouselStore((s) => s.styleConfig)
  const setStyleConfig = useCarouselStore((s) => s.setStyleConfig)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: '#888', margin: 0 }}>스타일</h3>

      {/* Color Presets */}
      <div>
        <label style={{ fontSize: 10, color: '#666', marginBottom: 4, display: 'block' }}>컬러 프리셋</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setStyleConfig({ primaryColor: p.primary, accentColor: p.accent })}
              title={p.label}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: `linear-gradient(135deg, ${p.primary} 50%, ${p.accent} 50%)`,
                border: styleConfig.primaryColor === p.primary ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Primary Color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 10, color: '#666', minWidth: 50 }}>주 색상</label>
        <input
          type="color"
          value={styleConfig.primaryColor || '#FF6B35'}
          onChange={(e) => setStyleConfig({ primaryColor: e.target.value })}
          style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
        />
        <span style={{ fontSize: 10, color: '#555' }}>{styleConfig.primaryColor}</span>
      </div>

      {/* Accent Color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 10, color: '#666', minWidth: 50 }}>강조색</label>
        <input
          type="color"
          value={styleConfig.accentColor || '#4ECDC4'}
          onChange={(e) => setStyleConfig({ accentColor: e.target.value })}
          style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
        />
        <span style={{ fontSize: 10, color: '#555' }}>{styleConfig.accentColor}</span>
      </div>

      {/* Background Color */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 10, color: '#666', minWidth: 50 }}>배경색</label>
        <input
          type="color"
          value={styleConfig.backgroundColor || '#0A0A0A'}
          onChange={(e) => setStyleConfig({ backgroundColor: e.target.value })}
          style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
        />
        <span style={{ fontSize: 10, color: '#555' }}>{styleConfig.backgroundColor}</span>
      </div>
    </div>
  )
}
