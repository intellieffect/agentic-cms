'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from '@/components/studio/store';

import { ProjectBar } from '@/components/studio/ProjectBar';
import { RemotionPreview } from '@/components/studio/RemotionPreview';
import { Timeline } from '@/components/studio/Timeline';
import { SubtitlePanel } from '@/components/studio/SubtitlePanel';
import { ClipPanel } from '@/components/studio/ClipPanel';
import { BgmPanel } from '@/components/studio/BgmPanel';
import { TransitionPanel } from '@/components/studio/TransitionPanel';
import { ReferencePanel } from '@/components/studio/ReferencePanel';
import { EffectPanel } from '@/components/studio/EffectPanel';

// ─── Project Summary types ───

interface ProjectSummary {
  id: string;
  name: string;
  clipCount: number;
  totalDuration: number;
  updatedAt: string | number;
  source: string;
}

// ─── Project List ───

function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${getEditorConfig().apiUrl}/api/projects`);
      const d = await r.json();
      setProjects(d.projects || []);
    } catch {
      setProjects([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const renameProject = async (id: string, newName: string) => {
    try {
      await fetch(`${getEditorConfig().apiUrl}/api/projects/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, dbId: id, name: newName }),
      });
      loadProjects();
    } catch { /* ignore */ }
    setEditingId(null);
  };

  const deleteProject = async (id: string) => {
    try {
      await fetch(`${getEditorConfig().apiUrl}/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadProjects();
    } catch { /* ignore */ }
    setDeleteConfirm(null);
  };

  const sorted = [...projects].sort((a, b) => {
    const ta = typeof a.updatedAt === 'number' ? a.updatedAt : Date.parse(a.updatedAt as string) || 0;
    const tb = typeof b.updatedAt === 'number' ? b.updatedAt : Date.parse(b.updatedAt as string) || 0;
    return tb - ta;
  });

  const formatDur = (s: number) => {
    if (s < 60) return `${Math.round(s)}s`;
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}m ${sec}s`;
  };

  const formatDate = (v: string | number) => {
    const ts = typeof v === 'number' ? v * 1000 : Date.parse(v as string);
    if (isNaN(ts)) return '-';
    const diff = Date.now() - ts;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const totalClips = projects.reduce((a, p) => a + (p.clipCount || 0), 0);
  const totalDuration = projects.reduce((a, p) => a + (p.totalDuration || 0), 0);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">영상 프로젝트</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length}개 프로젝트 / 클립 {totalClips}개 / {formatDur(totalDuration)}
            </p>
          </div>
          <button
            onClick={async () => {
              try {
                const r = await fetch(`${getEditorConfig().apiUrl}/api/projects/save`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: `새 프로젝트 ${new Date().toLocaleDateString('ko-KR')}`, clips: [], clipMeta: [], clipCrops: [], clipZooms: [], clipSubStyles: [], transitions: [], subs: [], globalSubs: [], bgmClips: [], totalDuration: 0, sources: [], orientation: 'horizontal' }),
                });
                if (r.ok) {
                  const d = await r.json();
                  const id = d.dbId || d.id;
                  if (id) router.push(`/video/projects?project=${encodeURIComponent(id)}`);
                }
              } catch {}
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--be-accent)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            + 새 프로젝트
          </button>
        </div>

        {loading ? (
          <div className="text-muted-foreground text-sm text-center py-10">불러오는 중...</div>
        ) : sorted.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-20">
            프로젝트가 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent/10 cursor-pointer transition-colors group"
              >
                <span
                  className="text-sm"
                  style={{ color: p.source === 'db' ? '#60a5fa' : '#888' }}
                  onClick={() => router.push(`/video/projects?project=${encodeURIComponent(p.id)}`)}
                >
                  {p.source === 'db' ? '\u2601\uFE0F' : '\uD83D\uDCBB'}
                </span>
                {editingId === p.id ? (
                  <input
                    autoFocus
                    className="flex-1 text-sm font-medium bg-transparent border-b border-muted-foreground text-foreground outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => { if (editName.trim()) renameProject(p.id, editName.trim()); else setEditingId(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && editName.trim()) renameProject(p.id, editName.trim()); if (e.key === 'Escape') setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-medium text-foreground truncate flex items-center gap-2"
                    onClick={() => router.push(`/video/projects?project=${encodeURIComponent(p.id)}`)}
                  >
                    {p.name || p.id}
                    <button
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
                      onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name || p.id); }}
                      title="이름 수정"
                    >
                      ✏️
                    </button>
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex-shrink-0" onClick={() => router.push(`/video/projects?project=${encodeURIComponent(p.id)}`)}>
                  {p.clipCount || 0} clips
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0" onClick={() => router.push(`/video/projects?project=${encodeURIComponent(p.id)}`)}>
                  {formatDur(p.totalDuration || 0)}
                </span>
                <span className="text-xs text-muted-foreground/60 flex-shrink-0" onClick={() => router.push(`/video/projects?project=${encodeURIComponent(p.id)}`)}>
                  {formatDate(p.updatedAt)}
                </span>
                {deleteConfirm === p.id ? (
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button className="px-2 py-1 text-xs rounded text-white" style={{ background: '#dc2626' }} onClick={() => deleteProject(p.id)}>삭제</button>
                    <button className="px-2 py-1 text-xs rounded border border-border text-muted-foreground" onClick={() => setDeleteConfirm(null)}>취소</button>
                  </div>
                ) : (
                  <button
                    className="text-muted-foreground hover:text-red-400 flex-shrink-0 transition-colors"
                    style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(p.id); }}
                    title="프로젝트 삭제"
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Studio Editor ───

function StudioEditor({ projectId }: { projectId: string }) {
  const loadProject = useEditorStore((s) => s.loadProject);
  const activePanel = useEditorStore((s) => s.activePanel);
  const clips = useEditorStore((s) => s.clips);

  // Load project on mount
  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const r = await fetch(`${getEditorConfig().apiUrl}/api/projects/load/${encodeURIComponent(projectId)}`);
        if (r.ok) {
          const data = await r.json();
          loadProject({ ...data, id: projectId });

          const sources = (data.clips || []).map((c: { source: string }) => c.source);
          const bgmSources = (data.bgmClips || []).map((b: { source: string }) => b.source);
          const allFiles = [...new Set([...sources, ...bgmSources])].filter(Boolean);
          if (allFiles.length > 0) {
            fetch(`${getEditorConfig().apiUrl}/api/resolver/resolve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filenames: allFiles }),
            }).catch(() => {});
          }
          return;
        }
        const r2 = await fetch(`${getEditorConfig().apiUrl}/api/projects/${encodeURIComponent(projectId)}`);
        if (r2.ok) {
          const d = await r2.json();
          const proj = d.project || d;
          if (proj.data) {
            loadProject({ ...proj.data, id: projectId, name: proj.name });
          } else {
            loadProject({ ...proj, id: projectId });
          }
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [projectId, loadProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        useEditorStore.getState().togglePlayback();
      }

      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !isInput) {
        e.preventDefault();
        const store = useEditorStore.getState();
        const delta = e.code === 'ArrowLeft' ? -1 : 1;
        const frame = Math.max(0, store.currentFrame + delta);
        useEditorStore.getState().seekToFrame(frame);
      }

      if (e.code === 'KeyB' && !isInput) {
        e.preventDefault();
        const state = useEditorStore.getState();
        const currentTime = state.currentFrame / 30;
        let cursor = 0;
        for (let i = 0; i < state.clips.length; i++) {
          const speed = state.clipMeta[i]?.speed ?? 1;
          const dur = (state.clips[i].end - state.clips[i].start) / speed;
          if (currentTime >= cursor && currentTime < cursor + dur) {
            const splitAt = state.clips[i].start + (currentTime - cursor) * speed;
            if (splitAt > state.clips[i].start + 0.1 && splitAt < state.clips[i].end - 0.1) {
              state.splitClip(i, splitAt);
            }
            break;
          }
          cursor += dur;
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const data = useEditorStore.getState().getProjectData();
        fetch(`${getEditorConfig().apiUrl}/api/projects/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const panels = [
    { key: 'subtitle' as const, label: '자막' },
    { key: 'clip' as const, label: '클립' },
    { key: 'bgm' as const, label: 'BGM' },
    { key: 'transition' as const, label: '전환' },
    { key: 'reference' as const, label: '레퍼런스' },
    { key: 'effect' as const, label: '이펙트' },
  ];

  const [panelWidth, setPanelWidth] = React.useState(500);
  const panelInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!panelInitRef.current) {
      panelInitRef.current = true;
      setPanelWidth(Math.round(window.innerWidth * 0.675));
    }
  }, []);
  const [timelineHeight, setTimelineHeight] = React.useState(380);
  const panelDrag = React.useRef<{ startX: number; startW: number } | null>(null);
  const tlDrag = React.useRef<{ startY: number; startH: number } | null>(null);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panelDrag.current) {
        const delta = panelDrag.current.startX - e.clientX;
        setPanelWidth(Math.max(Math.round(window.innerWidth * 0.5), Math.min(Math.round(window.innerWidth * 0.7), panelDrag.current.startW + delta)));
      }
      if (tlDrag.current) {
        const delta = tlDrag.current.startY - e.clientY;
        setTimelineHeight(Math.max(350, Math.min(600, tlDrag.current.startH + delta)));
      }
    };
    const onUp = () => {
      panelDrag.current = null;
      tlDrag.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 3.5rem)', overflow: 'hidden' }}>
      <ProjectBar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0a0a', overflow: 'hidden', minWidth: 100, minHeight: 0,
        }}>
          <RemotionPreview />
        </div>

        <div
          onMouseDown={(e) => {
            e.preventDefault();
            panelDrag.current = { startX: e.clientX, startW: panelWidth };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          style={{ width: 5, cursor: 'col-resize', background: '#1a1a1a', flexShrink: 0, transition: 'background .15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
        />

        <div style={{
          width: panelWidth, flexShrink: 0, background: '#141414',
          borderLeft: '1px solid #2a2a2a', overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
            {panels.map((tab) => (
              <button
                key={tab.key}
                onClick={() => useEditorStore.getState().setActivePanel(tab.key)}
                style={{
                  flex: 1, borderRadius: 0, border: 'none',
                  borderBottom: activePanel === tab.key ? '2px solid #60a5fa' : '2px solid transparent',
                  fontSize: 10, padding: '8px 0',
                  background: activePanel === tab.key ? '#1a1a2a' : 'transparent',
                  color: activePanel === tab.key ? '#60a5fa' : '#888',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {activePanel === 'subtitle' && <SubtitlePanel />}
            {activePanel === 'clip' && <ClipPanel />}
            {activePanel === 'bgm' && <BgmPanel />}
            {activePanel === 'transition' && <TransitionPanel />}
            {activePanel === 'reference' && <ReferencePanel />}
            {activePanel === 'effect' && <EffectPanel />}
            {!activePanel && clips.length > 0 && (
              <div style={{ padding: 12, color: '#555', fontSize: 11 }}>
                타임라인에서 클립이나 자막을 선택하세요
              </div>
            )}
            {!activePanel && clips.length === 0 && (
              <div style={{ padding: 12, color: '#555', fontSize: 11 }}>
                미디어 탭에서 영상을 추가하세요
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        onMouseDown={(e) => {
          e.preventDefault();
          tlDrag.current = { startY: e.clientY, startH: timelineHeight };
          document.body.style.cursor = 'row-resize';
          document.body.style.userSelect = 'none';
        }}
        style={{ height: 5, cursor: 'row-resize', background: '#1a1a1a', flexShrink: 0, transition: 'background .15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
      />

      <div style={{ height: timelineHeight, flexShrink: 0 }}>
        <Timeline />
      </div>
    </div>
  );
}

// ─── Page Router ───

function VideoProjectsContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');

  if (projectId) {
    return <StudioEditor projectId={projectId} />;
  }

  return <ProjectList />;
}

export default function VideoProjectsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">로딩 중...</div>}>
      <VideoProjectsContent />
    </Suspense>
  );
}
