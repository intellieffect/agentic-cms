'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

interface PlanItem {
  id: string
  title: string
  type: string
  status: string
  created_at: string
  updated_at: string
}

interface CarouselItem {
  id: string
  title: string
  slides: { templateId: string }[]
  updated_at: string
}

export default function ContentDashboardPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [planTotal, setPlanTotal] = useState(0)
  const [carousels, setCarousels] = useState<CarouselItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [planRes, carRes] = await Promise.all([
      fetch('/api/plans?limit=10').then(r => r.json()).catch(() => ({ plans: [], total: 0 })),
      fetch('/api/carousels?limit=10').then(r => r.json()).catch(() => ({ carousels: [] })),
    ])
    setPlans((planRes.plans || []).slice(0, 5))
    setPlanTotal(planRes.total || 0)
    setCarousels((carRes.carousels || []).slice(0, 5))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const formatDate = (v: string) => {
    const d = new Date(v)
    if (isNaN(d.getTime())) return '-'
    const diff = Date.now() - d.getTime()
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <div className="top-bar">
        <span className="top-bar-title">✍️ 콘텐츠</span>
        <div className="sep" />
        <span style={{ fontSize: 11, color: '#555' }}>
          에이전트가 생성한 기획 · 캐러셀을 확인하고 편집하세요
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ color: '#555', fontSize: 12, padding: 40, textAlign: 'center' }}>불러오는 중...</div>
        ) : (
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            {/* 통계 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { icon: '📋', label: '기획', count: planTotal, color: '#3b82f6', href: editorRoute('/content/plans') },
                { icon: '🎠', label: '캐러셀', count: carousels.length, color: '#ff6b35', href: editorRoute('/carousel') },
              ].map((s) => (
                <div
                  key={s.label}
                  onClick={() => router.push(s.href)}
                  style={{
                    background: '#111', border: '1px solid #222', borderRadius: 12, padding: '20px 18px',
                    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}<span style={{ fontSize: 11, color: '#555', marginLeft: 3 }}>개</span></div>
                  </div>
                </div>
              ))}
            </div>

            {/* 최근 캐러셀 */}
            <Section
              title="🎠 최근 캐러셀"
              emptyText="에이전트에게 블로그 글을 전달하면 캐러셀이 생성됩니다"
              actionLabel="전체"
              onAction={() => router.push(editorRoute('/carousel'))}
            >
              {carousels.map((c) => (
                <ListItem
                  key={c.id}
                  onClick={() => router.push(editorRoute(`/carousel/${c.id}`))}
                  title={c.title || '제목 없음'}
                  meta={`${c.slides?.length || 0}장`}
                  date={formatDate(c.updated_at)}
                />
              ))}
            </Section>

            {/* 최근 기획 */}
            <Section
              title="📋 최근 기획"
              emptyText="에이전트에게 블로그 글을 전달하면 기획이 자동 생성됩니다"
              actionLabel="전체"
              onAction={() => router.push(editorRoute('/content/plans'))}
            >
              {plans.map((p) => (
                <ListItem
                  key={p.id}
                  onClick={() => router.push(editorRoute(`/content/plans/${p.id}`))}
                  title={p.title || '제목 없음'}
                  meta={p.type === 'both' ? '캐러셀+영상' : p.type === 'carousel' ? '캐러셀' : '영상'}
                  date={formatDate(p.created_at)}
                />
              ))}
            </Section>

            {/* 안내 */}
            <div style={{
              marginTop: 24, padding: 20, background: '#111', border: '1px solid #222',
              borderRadius: 12, fontSize: 13, color: '#888', lineHeight: 1.8,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ccc', marginBottom: 8 }}>💡 사용 방법</div>
              <div>1. 텔레그램/디스코드에서 에이전트에게 블로그 글을 전달하세요</div>
              <div>2. 에이전트가 자동으로 기획(캐러셀 + 영상)을 생성합니다</div>
              <div>3. 이 페이지에서 생성된 기획을 확인하고 편집하세요</div>
              <div>4. 기획을 확정 후 캐러셀/영상 프로젝트를 생성하세요</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function Section({ title, children, emptyText, actionLabel, onAction }: {
  title: string; children: React.ReactNode; emptyText: string; actionLabel: string; onAction: () => void
}) {
  const items = Array.isArray(children) ? children : children ? [children] : []
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#eee' }}>{title}</div>
        <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={onAction}>{actionLabel}</button>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#555', fontSize: 12 }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
      )}
    </div>
  )
}

function ListItem({ title, meta, date, onClick }: { title: string; meta: string; date: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ flex: 1, fontSize: 12, color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      <span style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>{meta}</span>
      <span style={{ fontSize: 9, color: '#555', flexShrink: 0 }}>{date}</span>
    </div>
  )
}
