'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';

interface RenderDialogProps {
  open: boolean;
  onClose: () => void;
}

export const RenderDialog: React.FC<RenderDialogProps> = ({ open, onClose }) => {
  const getProjectData = useEditorStore((s) => s.getProjectData);
  const name = useEditorStore((s) => s.name);

  const [status, setStatus] = useState<'idle' | 'requesting' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStatus('idle');
      setProgress(0);
      setPhase('');
      setErrorMsg('');
      setSaving(false);
      setSaved(false);
    }
  }, [open]);

  const handleSaveToFinished = async () => {
    setSaving(true);
    try {
      const data = getProjectData();
      const r = await fetch(`${getEditorConfig().apiUrl}/api/finished/from-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: `${getEditorConfig().apiUrl}/api/render-remotion/download`,
          name: name || '렌더링 영상',
          projectId: data.id || (data as unknown as Record<string, unknown>).dbId,
        }),
      });
      if (r.ok) {
        setSaved(true);
      } else {
        const d = await r.json().catch(() => ({}));
        alert('저장 실패: ' + (d.error || r.status));
      }
    } catch {
      alert('저장 실패');
    }
    setSaving(false);
  };

  const pollStatus = useCallback(async () => {
    try {
      const r = await fetch(`${getEditorConfig().apiUrl}/api/render-remotion/status`);
      const d = await r.json();
      const st = d.state || d.status;
      if (st === 'rendering' || st === 'starting') {
        setProgress(d.progress || 0);
        setPhase(d.phase || '렌더링 중...');
        setStatus('rendering');
        pollRef.current = setTimeout(pollStatus, 1000);
      } else if (st === 'done') {
        setStatus('done');
        setProgress(100);
      } else if (st === 'error') {
        setStatus('error');
        setErrorMsg(d.error || '알 수 없는 오류');
      } else {
        // idle/queued
        pollRef.current = setTimeout(pollStatus, 1000);
      }
    } catch {
      setStatus('error');
      setErrorMsg('상태 확인 실패');
    }
  }, []);

  const handleRender = useCallback(async () => {
    setStatus('requesting');
    setProgress(0);
    setErrorMsg('');
    try {
      const data = getProjectData();
      const res = await fetch(`${getEditorConfig().apiUrl}/api/render-remotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      setStatus('rendering');
      pollRef.current = setTimeout(pollStatus, 1000);
    } catch (e: unknown) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, [getProjectData, pollStatus]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `${getEditorConfig().apiUrl}/api/render-remotion/download`;
    a.download = `${name || 'video'}.mp4`;
    a.click();
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'rendering') onClose(); }}
    >
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 8,
        padding: 24,
        width: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>영상 렌더링</div>

        {status === 'idle' && (
          <>
            <div style={{ fontSize: 12, color: '#888' }}>
              현재 프로젝트를 MP4로 렌더링합니다.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="be-btn" onClick={onClose}>취소</button>
              <button className="be-btn be-btn-pri" onClick={handleRender}>렌더 시작</button>
            </div>
          </>
        )}

        {status === 'requesting' && (
          <div style={{ fontSize: 12, color: '#f59e0b', textAlign: 'center', padding: 12 }}>
            렌더 요청 중...
          </div>
        )}

        {status === 'rendering' && (
          <>
            <div style={{ fontSize: 12, color: '#f59e0b' }}>
              {phase || '렌더 중...'} — {progress}%
            </div>
            <div style={{ height: 8, background: '#333', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #7c3aed, #3b82f6)',
                borderRadius: 4,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={{ fontSize: 12, color: '#22c55e', textAlign: 'center', padding: 8 }}>
              렌더링 완료!
            </div>
            {saved && (
              <div style={{ fontSize: 11, color: '#60a5fa', textAlign: 'center', padding: 4 }}>
                ✅ 완료 영상에 저장됨
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="be-btn" onClick={onClose}>닫기</button>
              {!saved && (
                <button
                  className="be-btn"
                  style={{ color: '#60a5fa', borderColor: '#60a5fa44' }}
                  onClick={handleSaveToFinished}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '📥 완료 영상 저장'}
                </button>
              )}
              <button className="be-btn be-btn-pri" onClick={handleDownload}>다운로드</button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 12, color: '#ef4444', padding: 8 }}>
              오류: {errorMsg}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="be-btn" onClick={onClose}>닫기</button>
              <button className="be-btn" onClick={handleRender}>재시도</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
