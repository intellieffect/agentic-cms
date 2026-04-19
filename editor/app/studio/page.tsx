/**
 * /studio — Remotion-based video editor (modern).
 *
 * This page provides the React/Remotion-based timeline editor with
 * live preview, clip management, subtitles, and BGM support.
 *
 * For the legacy iframe-based editor, see /editor.
 */
'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEditorStore } from '@/components/studio/store';

// Suppress Remotion video playback errors in dev (browser decoder limit)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message?.includes('error while playing the video') || e.message?.includes('error playing video') || e.message?.includes('Error occurred in video')) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return true;
    }
  });
}
import { ProjectBar } from '@/components/studio/ProjectBar';
import { RemotionPreview } from '@/components/studio/RemotionPreview';
import { Timeline } from '@/components/studio/Timeline';
import { SubtitlePanel } from '@/components/studio/SubtitlePanel';
import { ClipPanel } from '@/components/studio/ClipPanel';
import { BgmPanel } from '@/components/studio/BgmPanel';
import { TransitionPanel } from '@/components/studio/TransitionPanel';
import { ReferencePanel } from '@/components/studio/ReferencePanel';
import { EffectPanel } from '@/components/studio/EffectPanel';
// ExportPanel moved to ProjectBar

function StudioContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project') || '';

  const loadProject = useEditorStore((s) => s.loadProject);
  const activePanel = useEditorStore((s) => s.activePanel);
  const clips = useEditorStore((s) => s.clips);

  // Load project on mount
  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        // Try loading from save API (which returns full project data)
        const r = await fetch(`/api/projects/load/${encodeURIComponent(projectId)}`);
        if (r.ok) {
          const data = await r.json();
          loadProject({ ...data, id: projectId });

          // 소스 파일 자동 리졸브 — 로컬 경로에서 영상 찾아서 심볼릭 링크
          const sources = (data.clips || []).map((c: { source: string }) => c.source);
          const bgmSources = (data.bgmClips || []).map((b: { source: string }) => b.source);
          const allFiles = [...new Set([...sources, ...bgmSources])].filter(Boolean);
          if (allFiles.length > 0) {
            fetch('/api/resolver/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filenames: allFiles }),
            }).catch(() => {});
          }
          return;
        }
        // Fallback: try project detail endpoint
        const r2 = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
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

      // Space: play/pause
      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        const player = (window as unknown as Record<string, unknown>).__studioPlayerRef as { toggle?: () => void } | undefined;
        if (player?.toggle) player.toggle();
      }

      // Left/Right: frame seek
      if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !isInput) {
        e.preventDefault();
        const store = useEditorStore.getState();
        const delta = e.code === 'ArrowLeft' ? -1 : 1;
        const frame = Math.max(0, store.currentFrame + delta);
        const seekTo = (window as unknown as Record<string, (f: number) => void>).__studioSeekTo;
        if (seekTo) seekTo(frame);
      }

      // Delete handled in Timeline.tsx (with activePanel check)

      // B: blade (split clip at current playhead)
      if (e.code === 'KeyB' && !isInput) {
        e.preventDefault();
        const state = useEditorStore.getState();
        const currentTime = state.currentFrame / 30;
        // Find which clip is at currentTime
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

      // Cmd+S: save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const data = useEditorStore.getState().getProjectData();
        fetch('/api/projects/save', {
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

  // Resizable state
  // 3:7 비율 — 프리뷰 30%, 패널 70%
  const [panelWidth, setPanelWidth] = React.useState(900);
  const panelInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!panelInitRef.current) {
      panelInitRef.current = true;
      setPanelWidth(Math.round(window.innerWidth * 0.7));
    }
  }, []);
  const [timelineHeight, setTimelineHeight] = React.useState(380);
  const panelDrag = React.useRef<{ startX: number; startW: number } | null>(null);
  const tlDrag = React.useRef<{ startY: number; startH: number } | null>(null);

  // Panel horizontal resize
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panelDrag.current) {
        const delta = panelDrag.current.startX - e.clientX;
        setPanelWidth(Math.max(280, Math.min(1200, panelDrag.current.startW + delta)));
      }
      if (tlDrag.current) {
        const delta = tlDrag.current.startY - e.clientY;
        setTimelineHeight(Math.max(350, Math.min(600, tlDrag.current.startH + delta)));
      }
    };
    const onUp = () => { panelDrag.current = null; tlDrag.current = null; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <ProjectBar />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Preview */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          overflow: 'hidden',
          minWidth: 100,
        }}>
          <RemotionPreview />
        </div>

        {/* Resize handle — horizontal (preview ↔ panel) */}
        <div
          onMouseDown={(e) => { e.preventDefault(); panelDrag.current = { startX: e.clientX, startW: panelWidth }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
          style={{ width: 5, cursor: 'col-resize', background: '#1a1a1a', flexShrink: 0, transition: 'background .15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
        />

        {/* Right panel */}
        <div style={{
          width: panelWidth,
          flexShrink: 0,
          background: '#141414',
          borderLeft: '1px solid #2a2a2a',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Panel tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid #2a2a2a',
            flexShrink: 0,
          }}>
            {panels.map((tab) => (
              <button
                key={tab.key}
                className={`btn ${activePanel === tab.key ? 'btn-on' : ''}`}
                onClick={() => useEditorStore.getState().setActivePanel(tab.key)}
                style={{
                  flex: 1,
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: activePanel === tab.key ? '2px solid #60a5fa' : '2px solid transparent',
                  fontSize: 10,
                  padding: '8px 0',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
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

      {/* Resize handle — vertical (main ↔ timeline) */}
      <div
        onMouseDown={(e) => { e.preventDefault(); tlDrag.current = { startY: e.clientY, startH: timelineHeight }; document.body.style.cursor = 'row-resize'; document.body.style.userSelect = 'none'; }}
        style={{ height: 5, cursor: 'row-resize', background: '#1a1a1a', flexShrink: 0, transition: 'background .15s' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#1a1a1a')}
      />

      {/* Timeline */}
      <div style={{ height: timelineHeight, flexShrink: 0 }}>
        <Timeline />
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', padding: 40 }}>스튜디오 로딩 중...</div>}>
      <StudioContent />
    </Suspense>
  );
}
