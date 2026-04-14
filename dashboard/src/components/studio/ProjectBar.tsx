'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { editorRoute } from '@/lib/editor-routes';
import { theme } from '@/lib/editor-theme';
import { useEditorStore } from './store';
import { RenderDialog } from './RenderDialog';
import type { Clip } from './types';

export const ProjectBar: React.FC = () => {
  const router = useRouter();
  const name = useEditorStore((s) => s.name);
  const setName = useEditorStore((s) => s.setName);
  const getProjectData = useEditorStore((s) => s.getProjectData);
  const addClip = useEditorStore((s) => s.addClip);
  const subsEnabled = useEditorStore((s) => s.subsEnabled);
  const bgmEnabled = useEditorStore((s) => s.bgmEnabled);
  const setSubsEnabled = useEditorStore((s) => s.setSubsEnabled);
  const setBgmEnabled = useEditorStore((s) => s.setBgmEnabled);
  const orientation = useEditorStore((s) => s.orientation);
  const setOrientation = useEditorStore((s) => s.setOrientation);

  const globalSubs = useEditorStore((s) => s.globalSubs);
  const exportSrt = useEditorStore((s) => s.exportSrt);

  const exportRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [renderOpen, setRenderOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      const data = getProjectData();
      const r = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        setSaveStatus('저장됨');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('실패');
      }
    } catch {
      setSaveStatus('실패');
    }
    setSaving(false);
  }, [getProjectData]);

  const handleDuplicate = useCallback(async () => {
    const newName = prompt('복제할 프로젝트 이름', `${name} (사본)`);
    if (!newName) return;
    try {
      const data = getProjectData();
      // 새 ID로 저장 (id, dbId 제거)
      const raw = data as unknown as Record<string, unknown>;
      const { id: _id, ...rest } = raw;
      delete rest.dbId;
      const dupData = { ...rest, id: `proj_${Date.now()}`, name: newName };
      const r = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dupData),
      });
      if (r.ok) {
        const d = await r.json();
        const newId = d.dbId || d.id;
        if (newId) router.push(editorRoute(`/studio?project=${encodeURIComponent(newId)}`));
      }
    } catch {
      alert('복제 실패');
    }
  }, [getProjectData, name, router]);

  return (
    <>
      <div className="top-bar">
        <button
          className="btn"
          style={{ fontSize: 12, padding: '4px 8px' }}
          onClick={() => router.push(editorRoute('/'))}
        >
          &larr; 프로젝트
        </button>
        <div className="sep" />

        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false); }}
              autoFocus
              style={{
                flex: 1, background: theme.bgInput, border: `1px solid ${theme.borderHover}`,
                borderRadius: 4, padding: '4px 8px', color: '#fff', fontSize: 14,
              }}
            />
            <button className="btn" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>OK</button>
          </div>
        ) : (
          <span
            className="top-bar-title"
            style={{ cursor: 'pointer' }}
            onClick={() => setEditing(true)}
            title="클릭하여 이름 수정"
          >
            {name || '새 프로젝트'}
          </span>
        )}

        <div className="top-bar-right">
          {/* 포맷 선택 */}
          <div style={{ display: 'flex', gap: 2, background: theme.bgInput, borderRadius: 6, padding: 2 }}>
            {([
              { value: 'vertical' as const, label: '9:16', title: '세로 (1080×1920)' },
              { value: 'square' as const, label: '1:1', title: '정방형 (1080×1080)' },
              { value: 'horizontal' as const, label: '16:9', title: '가로 (1920×1080)' },
            ]).map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => setOrientation(fmt.value)}
                title={fmt.title}
                style={{
                  padding: '3px 8px', fontSize: 10, fontWeight: orientation === fmt.value ? 600 : 400,
                  color: orientation === fmt.value ? '#fff' : '#666',
                  background: orientation === fmt.value ? '#ff6b6b' : 'transparent',
                  border: 'none', borderRadius: 4, cursor: 'pointer', transition: 'all .15s',
                }}
              >{fmt.label}</button>
            ))}
          </div>
          {/* 자막 토글 */}
          <button
            className="btn"
            style={{
              fontSize: 10, padding: '4px 8px',
              color: subsEnabled ? '#f59e0b' : '#555',
              borderColor: subsEnabled ? '#f59e0b44' : '#333',
            }}
            onClick={() => setSubsEnabled(!subsEnabled)}
            title={subsEnabled ? '자막 숨기기' : '자막 표시'}
          >
            {subsEnabled ? '🔤' : '🚫🔤'}
          </button>
          {/* BGM 토글 */}
          <button
            className="btn"
            style={{
              fontSize: 10, padding: '4px 8px',
              color: bgmEnabled ? '#10b981' : '#555',
              borderColor: bgmEnabled ? '#10b98144' : '#333',
            }}
            onClick={() => setBgmEnabled(!bgmEnabled)}
            title={bgmEnabled ? 'BGM 숨기기' : 'BGM 표시'}
          >
            {bgmEnabled ? '🎵' : '🚫🎵'}
          </button>
          <div style={{ width: 1, height: 16, background: theme.border }} />
          <button
            className="btn"
            style={{ color: theme.accent, borderColor: theme.accent }}
            onClick={async () => {
              try {
                const r = await fetch('/api/resolver/pick-file', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: '영상', multiple: true }),
                });
                if (!r.ok) return;
                const d = await r.json();
                if (d.error) return;
                const paths: string[] = d.filepaths || (d.filepath ? [d.filepath] : []);
                if (paths.length === 0) return;
                for (const filepath of paths) {
                  const fname = filepath.split('/').pop() || 'video.mp4';
                  const linkRes = await fetch('/api/resolver/link-file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: fname, filepath }),
                  });
                  if (!linkRes.ok) continue;
                  const linkData = await linkRes.json();
                  if (linkData.error) continue;
                  let duration = 10;
                  for (let retry = 0; retry < 3; retry++) {
                    try {
                      const pr = await fetch(`/api/media/probe/${encodeURIComponent(fname)}`);
                      if (pr.ok) {
                        const pd = await pr.json();
                        if (pd.duration && pd.duration > 0) { duration = pd.duration; break; }
                      }
                    } catch {}
                    await new Promise((r) => setTimeout(r, 500));
                  }
                  addClip({ source: fname, start: 0, end: duration, source_idx: 0 } as Clip);
                }
              } catch (e) {
                console.error('[영상 추가] 실패:', e);
              }
            }}
          >
            📂 영상 추가
          </button>
          {saveStatus && (
            <span style={{ fontSize: 10, color: saveStatus === '저장됨' ? '#22c55e' : '#ef4444' }}>
              {saveStatus}
            </span>
          )}
          {/* 내보내기 드롭다운 */}
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button
              className="btn"
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => setExportOpen(!exportOpen)}
              title="내보내기"
            >
              📤 내보내기
            </button>
            {exportOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 4,
                  background: theme.bgBtn,
                  border: `1px solid ${theme.borderHover}`,
                  borderRadius: 6,
                  padding: 4,
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  minWidth: 160,
                }}
              >
                <button
                  style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: '#ddd', padding: '8px 12px', fontSize: 11, cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  onClick={() => {
                    exportSrt();
                    setExportOpen(false);
                  }}
                  disabled={globalSubs.length === 0}
                >
                  📝 SRT 자막 다운로드 {globalSubs.length > 0 && <span style={{ color: '#666', fontSize: 9 }}>({globalSubs.length}개)</span>}
                </button>
                <button
                  style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: '#ddd', padding: '8px 12px', fontSize: 11, cursor: 'pointer', textAlign: 'left', borderRadius: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  onClick={() => {
                    const data = getProjectData();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${data.name || 'project'}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setExportOpen(false);
                  }}
                >
                  📦 프로젝트 JSON 다운로드
                </button>
              </div>
            )}
          </div>
          <button
            className="btn"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={handleDuplicate}
            title="프로젝트 복제"
          >
            📋 복제
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <button className="btn btn-pri" onClick={() => setRenderOpen(true)}>
            렌더
          </button>
        </div>
      </div>

      <RenderDialog open={renderOpen} onClose={() => setRenderOpen(false)} />
    </>
  );
};
