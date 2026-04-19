/**
 * /editor — iframe-based video editor (legacy).
 *
 * This page wraps the HTML/JS video editor in an iframe.
 * Use this mode when you need the legacy cut-based editor workflow.
 *
 * For the modern Remotion-based editor, see /studio.
 */
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { editorRoute } from '@/lib/editor-routes';
import { getEditorConfig } from '@/editor.config';

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const project = searchParams.get('project') || '';
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [projectId, setProjectId] = useState(project);
  const [projectName, setProjectName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load project name from DB if project ID is a UUID
  const loadProject = useCallback(async (pid: string) => {
    if (!pid) return;
    try {
      const r = await fetch(`/api/projects/${pid}`);
      const d = await r.json();
      if (d.project?.name) setProjectName(d.project.name);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (project) loadProject(project); }, [project, loadProject]);

  // Listen for messages from editor iframe (project name/id updates)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'brxce-project-info') {
        if (e.data.name) setProjectName(e.data.name);
        if (e.data.dbId) setProjectId(e.data.dbId);
        else if (e.data.id) setProjectId(e.data.id);
      }
      if (e.data.type === 'brxce-download' && e.data.url) {
        // Handle download from iframe — fetch as blob to preserve filename
        const fname = e.data.filename || 'video.mp4';
        fetch(e.data.url.replace(getEditorConfig().apiUrl, ''))
          .then(r => r.blob())
          .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = fname; a.click();
            URL.revokeObjectURL(url);
          })
          .catch(() => { window.open(e.data.url); });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const saveName = async () => {
    if (!projectId || !projectName.trim()) return;
    setSaving(true);
    try {
      // Try DB update first
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      // Also notify iframe to update its internal state
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'brxce-rename-project', name: projectName.trim() }, '*'
      );
    } catch { /* ignore */ }
    setSaving(false);
    setEditing(false);
  };

  // Forward keyboard events to iframe via postMessage (cross-origin safe)
  useEffect(() => {
    const forward = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;

      // Send key info via postMessage (works cross-origin)
      iframe.contentWindow.postMessage({
        type: 'brxce-keydown',
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
      }, '*');

      // Prevent default for known editor shortcuts
      const editorKeys = ['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
        'KeyV','KeyC','KeyP','KeyJ','KeyK','KeyL','Home','End',
        'Delete','Backspace','Minus','Equal','NumpadSubtract','NumpadAdd'];
      if (editorKeys.includes(e.code)) e.preventDefault();

      iframe.focus();
    };
    window.addEventListener('keydown', forward);
    return () => window.removeEventListener('keydown', forward);
  }, []);

  // Auto-focus iframe on mount and when mouse enters
  const focusIframe = useCallback(() => {
    iframeRef.current?.focus();
  }, []);

  const { apiUrl } = getEditorConfig();
  const editorUrl = project
    ? `${apiUrl}/index.html?project=${encodeURIComponent(project)}`
    : `${apiUrl}/index.html`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div className="top-bar">
        <button
          className="btn"
          style={{ fontSize: '12px', padding: '4px 8px' }}
          onClick={() => router.push(editorRoute('/'))}
        >
          ← 프로젝트
        </button>
        <div className="sep" />
        {editing ? (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
              style={{
                flex: 1, background: '#1a1a1a', border: '1px solid #555',
                borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '14px',
              }}
            />
            <button className="btn btn-pri" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={saveName} disabled={saving}>
              {saving ? '...' : '저장'}
            </button>
            <button className="btn" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => setEditing(false)}>취소</button>
          </div>
        ) : (
          <span
            className="top-bar-title"
            style={{ cursor: 'pointer' }}
            onClick={() => setEditing(true)}
            title="클릭하여 이름 수정"
          >
            🎬 {projectName || '새 프로젝트'}
          </span>
        )}
      </div>

      {/* Editor iframe */}
      <iframe
        ref={iframeRef}
        src={editorUrl}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#0f0f0f',
        }}
        allow="autoplay; fullscreen"
        onLoad={focusIframe}
        onMouseEnter={focusIframe}
      />
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', padding: 40 }}>에디터 로딩 중...</div>}>
      <EditorContent />
    </Suspense>
  );
}
