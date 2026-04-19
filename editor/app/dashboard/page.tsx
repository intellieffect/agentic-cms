'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { editorRoute } from '@/lib/editor-routes';
import { theme } from '@/lib/theme';

interface ProjectSummary {
  id: string;
  name: string;
  clipCount: number;
  totalDuration: number;
  updatedAt: string | number;
  source: string;
}

interface CarouselSummary {
  id: string;
  title: string;
  slides: { templateId: string }[];
  updated_at: string;
  created_at: string;
}

interface PlanSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [carousels, setCarousels] = useState<CarouselSummary[]>([]);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [refCount, setRefCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, carRes, refRes, planRes] = await Promise.all([
        fetch('/api/projects').then(r => r.json()).catch(() => ({ projects: [] })),
        fetch('/api/carousels?limit=100').then(r => r.json()).catch(() => ({ carousels: [], total: 0 })),
        fetch('/api/ref-posts?post_type=carousel&limit=1').then(r => r.json()).catch(() => ({ total: 0 })),
        fetch('/api/plans').then(r => r.json()).catch(() => ({ plans: [] })),
      ]);
      setProjects(projRes.projects || []);
      setCarousels(carRes.carousels || []);
      setRefCount(refRes.total || 0);
      setPlans(planRes.plans || []);
    } catch {
      setProjects([]);
      setCarousels([]);
      setPlans([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalClips = projects.reduce((a, p) => a + (p.clipCount || 0), 0);
  const totalDuration = projects.reduce((a, p) => a + (p.totalDuration || 0), 0);
  const totalSlides = carousels.reduce((a, c) => a + (c.slides?.length || 0), 0);
  const plansDraft = plans.filter(p => p.status === 'draft').length;
  const plansConfirmed = plans.filter(p => p.status === 'confirmed').length;
  const plansExecuted = plans.filter(p => p.status === 'executed').length;

  const recentPlans = [...plans]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5);

  const recentCarousels = [...carousels]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 5);

  const recentProjects = [...projects]
    .sort((a, b) => {
      const ta = typeof a.updatedAt === 'number' ? a.updatedAt : Date.parse(a.updatedAt as string) || 0;
      const tb = typeof b.updatedAt === 'number' ? b.updatedAt : Date.parse(b.updatedAt as string) || 0;
      return tb - ta;
    })
    .slice(0, 5);

  const formatDur = (s: number) => {
    if (s < 60) return `${Math.round(s)}초`;
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}분 ${sec}초`;
  };

  const formatDate = (v: string | number) => {
    const ts = typeof v === 'number' ? v * 1000 : Date.parse(v as string);
    if (isNaN(ts)) return '-';
    const diff = Date.now() - ts;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const statCards = [
    { label: '기획', value: plans.length, unit: '개', color: '#8b5cf6', icon: '📋', sub: `초안 ${plansDraft} · 확정 ${plansConfirmed} · 실행 ${plansExecuted}` },
    { label: '캐러셀', value: carousels.length, unit: '개', color: '#ff6b35', icon: '🎠', sub: `슬라이드 ${totalSlides}장` },
    { label: '영상 프로젝트', value: projects.length, unit: '개', color: '#60a5fa', icon: '🎬', sub: `클립 ${totalClips}개 · ${formatDur(totalDuration)}` },
    { label: '레퍼런스', value: refCount, unit: '개', color: '#22c55e', icon: '📌' },
  ];

  const quickActions = [
    { icon: '📋', label: '기획', onClick: () => router.push(editorRoute('/content/plans')) },
    { icon: '🎠', label: '캐러셀', onClick: () => router.push(editorRoute('/carousel')) },
    { icon: '📁', label: '영상 프로젝트', onClick: () => router.push(editorRoute('/')) },
    { icon: '🧩', label: '템플릿', onClick: () => router.push(editorRoute('/carousel/templates')) },
    { icon: '📌', label: '레퍼런스', onClick: () => router.push(editorRoute('/carousel/references')) },
    { icon: '🎞️', label: '완료 영상', onClick: () => router.push(editorRoute('/finished')) },
  ];

  return (
    <>
      <div className="top-bar">
        <span className="top-bar-title">📊 대시보드</span>
        <div className="sep" />
        <span style={{ fontSize: 11, color: theme.textDim }}>brxce editor</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {loading ? (
            <div style={{ color: theme.textDim, fontSize: 12, padding: 40, textAlign: 'center' }}>불러오는 중...</div>
          ) : (
            <>
              {/* 통계 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                {statCards.map((card) => (
                  <div key={card.label} style={{
                    background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: '20px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ fontSize: 28 }}>{card.icon}</div>
                    <div>
                      <div style={{ fontSize: 10, color: theme.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>
                        {card.value}<span style={{ fontSize: 11, color: theme.textDim, marginLeft: 3 }}>{card.unit}</span>
                      </div>
                      {card.sub && <div style={{ fontSize: 9, color: theme.textDim, marginTop: 2 }}>{card.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* 최근 기획 */}
              <div style={{ background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>📋 최근 기획</div>
                  <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => router.push(editorRoute('/content/plans'))}>전체</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {recentPlans.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: theme.textDim, fontSize: 11 }}>에이전트에게 블로그 글을 전달하면 기획이 생성됩니다</div>
                  ) : recentPlans.map((p) => {
                    const typeColor = p.type === 'carousel' ? '#ff6b35' : p.type === 'video' ? '#8b5cf6' : '#f59e0b';
                    const statusColor = p.status === 'draft' ? '#555' : p.status === 'confirmed' ? '#3b82f6' : '#22c55e';
                    const statusLabel = p.status === 'draft' ? '초안' : p.status === 'confirmed' ? '확정' : '실행됨';
                    return (
                      <div key={p.id} onClick={() => router.push(editorRoute(`/content/plans/${p.id}`))} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      }} onMouseEnter={e => e.currentTarget.style.background = theme.bgInput} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: typeColor + '22', color: typeColor }}>{p.type === 'both' ? '캐러셀+영상' : p.type === 'carousel' ? '캐러셀' : '영상'}</span>
                        <span style={{ flex: 1, fontSize: 12, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || '제목 없음'}</span>
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: statusColor + '22', color: statusColor }}>{statusLabel}</span>
                        <span style={{ fontSize: 9, color: theme.textDim }}>{formatDate(p.updated_at || p.created_at)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                {/* 최근 캐러셀 */}
                <div style={{ background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>🎠 최근 캐러셀</div>
                    <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => router.push(editorRoute('/carousel'))}>전체</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentCarousels.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => router.push(editorRoute(`/carousel/${c.id}`))}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgInput)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ flex: 1, fontSize: 12, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title || '제목 없음'}
                        </span>
                        <span style={{ fontSize: 10, color: theme.textMuted, flexShrink: 0 }}>{c.slides?.length || 0}장</span>
                        <span style={{ fontSize: 9, color: theme.textDim, flexShrink: 0 }}>{formatDate(c.updated_at || c.created_at)}</span>
                      </div>
                    ))}
                    {recentCarousels.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: theme.textDim, fontSize: 11 }}>캐러셀이 없습니다</div>
                    )}
                  </div>
                </div>

                {/* 최근 영상 프로젝트 */}
                <div style={{ background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>🎬 최근 영상 프로젝트</div>
                    <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => router.push(editorRoute('/'))}>전체</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentProjects.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => router.push(editorRoute(`/studio?project=${encodeURIComponent(p.id)}`))}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = theme.bgInput)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: 10, color: p.source === 'db' ? '#60a5fa' : '#888' }}>
                          {p.source === 'db' ? '☁️' : '💻'}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name || p.id}
                        </span>
                        <span style={{ fontSize: 10, color: theme.textMuted, flexShrink: 0 }}>{p.clipCount || 0}클립</span>
                        <span style={{ fontSize: 9, color: theme.textDim, flexShrink: 0 }}>{formatDate(p.updatedAt)}</span>
                      </div>
                    ))}
                    {recentProjects.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: theme.textDim, fontSize: 11 }}>프로젝트가 없습니다</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 빠른 작업 */}
              <div style={{ background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.text, marginBottom: 14 }}>⚡ 빠른 작업</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      className="btn"
                      style={{ padding: '16px 8px', fontSize: 11, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderRadius: 10 }}
                      onClick={action.onClick}
                    >
                      <span style={{ fontSize: 24 }}>{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
