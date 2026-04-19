'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getEditorConfig } from '@/editor.config';
import { useEditorStore } from './store';

interface MediaFile {
  name: string;
  path?: string;
  size?: number;
  duration?: number;
  thumbnail?: string;
}

export const MediaPanel: React.FC = () => {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addClip = useEditorStore((s) => s.addClip);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/list-videos');
      if (r.ok) {
        const data = await r.json();
        setFiles(data.videos || data.files || (Array.isArray(data) ? data : []));
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await fetch('/api/upload', { method: 'POST', body: formData });
      } catch {
        // ignore
      }
    }
    setUploading(false);
    fetchFiles();
  }, [fetchFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  // 영상 프리뷰 + 구간 선택 상태
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const openPreview = useCallback(async (file: MediaFile) => {
    let duration = file.duration || 0;
    if (!duration) {
      try {
        const r = await fetch(`/api/media/probe/${encodeURIComponent(file.name)}`);
        if (r.ok) {
          const d = await r.json();
          duration = d.duration || 10;
        }
      } catch {
        duration = 10;
      }
    }
    setPreviewFile(file);
    setPreviewDuration(duration);
    setInPoint(0);
    setOutPoint(duration);
  }, []);

  const addClipFromPreview = useCallback(() => {
    if (!previewFile) return;
    addClip({
      source: previewFile.name,
      start: inPoint,
      end: outPoint,
      source_idx: 0,
    });
    setPreviewFile(null);
  }, [previewFile, inPoint, outPoint, addClip]);

  const handleAddClip = useCallback(async (file: MediaFile) => {
    // 더블클릭: 전체 구간 바로 추가 / 싱글클릭: 프리뷰 열기
    let duration = file.duration || 0;
    if (!duration) {
      try {
        const r = await fetch(`/api/media/probe/${encodeURIComponent(file.name)}`);
        if (r.ok) {
          const d = await r.json();
          duration = d.duration || 10;
        }
      } catch {
        duration = 10;
      }
    }
    addClip({
      source: file.name,
      start: 0,
      end: duration,
      source_idx: 0,
    });
  }, [addClip]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>

      {/* 영상 프리뷰 + 구간 선택 */}
      {previewFile && (
        <div style={{ background: '#111', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
            <span style={{ color: '#aaa', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {previewFile.name}
            </span>
            <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
          <video
            ref={previewVideoRef}
            src={`${getEditorConfig().apiUrl}${getEditorConfig().mediaProxyPrefix}/${encodeURIComponent(previewFile.name)}`}
            style={{ width: '100%', maxHeight: 200, objectFit: 'contain', background: '#000' }}
            controls
            playsInline
            onLoadedMetadata={(e) => {
              const d = (e.target as HTMLVideoElement).duration;
              if (d && d !== previewDuration) { setPreviewDuration(d); setOutPoint(d); }
            }}
          />
          {/* In/Out 구간 슬라이더 */}
          <div style={{ padding: '6px 8px' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9, color: '#888', marginBottom: 4 }}>
              <span>IN: {fmtTime(inPoint)}</span>
              <span style={{ flex: 1, textAlign: 'center' }}>구간: {fmtTime(outPoint - inPoint)}</span>
              <span>OUT: {fmtTime(outPoint)}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="range" min={0} max={previewDuration} step={0.1} value={inPoint}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setInPoint(Math.min(v, outPoint - 0.1));
                  if (previewVideoRef.current) previewVideoRef.current.currentTime = v;
                }}
                style={{ flex: 1, accentColor: '#22c55e' }}
              />
              <input
                type="range" min={0} max={previewDuration} step={0.1} value={outPoint}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setOutPoint(Math.max(v, inPoint + 0.1));
                  if (previewVideoRef.current) previewVideoRef.current.currentTime = v;
                }}
                style={{ flex: 1, accentColor: '#ef4444' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button
                onClick={() => { if (previewVideoRef.current) setInPoint(previewVideoRef.current.currentTime); }}
                style={{ flex: 1, padding: '4px 0', background: '#1a3a1a', border: '1px solid #22c55e', color: '#22c55e', borderRadius: 4, fontSize: 9, cursor: 'pointer' }}
              >[ IN 설정</button>
              <button
                onClick={() => { if (previewVideoRef.current) setOutPoint(previewVideoRef.current.currentTime); }}
                style={{ flex: 1, padding: '4px 0', background: '#3a1a1a', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 4, fontSize: 9, cursor: 'pointer' }}
              >] OUT 설정</button>
              <button
                onClick={addClipFromPreview}
                style={{ flex: 1, padding: '4px 0', background: '#1a1a3a', border: '1px solid #60a5fa', color: '#60a5fa', borderRadius: 4, fontSize: 9, cursor: 'pointer', fontWeight: 600 }}
              >+ 클립 추가</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
          미디어
        </div>
        <button
          className="btn"
          style={{ fontSize: 9, padding: '2px 6px' }}
          onClick={fetchFiles}
          disabled={loading}
        >
          {loading ? '...' : '새로고침'}
        </button>
      </div>

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#7c3aed' : '#333'}`,
          borderRadius: 6,
          padding: '12px 8px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#7c3aed11' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 11, color: dragOver ? '#7c3aed' : '#666' }}>
          {uploading ? '업로드 중...' : '파일을 드래그하거나 클릭'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {files.map((file) => (
          <div
            key={file.name}
            onClick={() => openPreview(file)}
            onDoubleClick={() => handleAddClip(file)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#444'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a'; }}
          >
            {file.thumbnail ? (
              <img
                src={file.thumbnail}
                alt=""
                style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 40, height: 40, background: '#222', borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#555', flexShrink: 0,
              }}>
                ▶
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, color: '#ccc',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {file.name}
              </div>
              <div style={{ fontSize: 9, color: '#555', display: 'flex', gap: 6 }}>
                {file.duration ? <span>{formatDuration(file.duration)}</span> : null}
                {file.size ? <span>{formatSize(file.size)}</span> : null}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddClip(file); }}
              style={{ fontSize: 14, color: '#60a5fa', flexShrink: 0, background: 'none', border: '1px solid #333', borderRadius: 4, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="타임라인에 추가"
            >+</button>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <div style={{ color: '#555', fontSize: 11, textAlign: 'center', padding: 20 }}>
            영상 파일 없음
          </div>
        )}
      </div>

      {/* 소스 디렉토리 관리 */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 4 }}>📂 소스 디렉토리</div>
        <button
          onClick={async () => {
            try {
              const r = await fetch('/api/resolver/pick-directory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
              if (r.ok) {
                const d = await r.json();
                if (d.directory) {
                  await fetch('/api/resolver/add-directory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ directory: d.directory }),
                  });
                  fetchFiles();
                }
              }
            } catch { /* ignore */ }
          }}
          style={{ width: '100%', padding: '5px 0', background: '#1a1a1a', border: '1px solid #333', color: '#888', borderRadius: 4, fontSize: 9, cursor: 'pointer' }}
        >
          + 소스 폴더 추가
        </button>
        <button
          onClick={async () => {
            try {
              // Finder에서 영상 파일 선택 → 심볼릭 링크 → 타임라인에 추가
              const r = await fetch('/api/resolver/pick-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: '영상' }),
              });
              if (!r.ok) return;
              const d = await r.json();
              if (!d.filepath) return;
              const fname = d.filepath.split('/').pop() || 'video.mp4';
              // 심볼릭 링크 생성
              await fetch('/api/resolver/link-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: fname, filepath: d.filepath }),
              });
              // 프로브로 duration 확인
              let duration = 10;
              try {
                const pr = await fetch(`/api/media/probe/${encodeURIComponent(fname)}`);
                if (pr.ok) { const pd = await pr.json(); duration = pd.duration || 10; }
              } catch {}
              // 타임라인에 바로 추가
              addClip({ source: fname, start: 0, end: duration, source_idx: 0 });
              fetchFiles();
            } catch {}
          }}
          style={{ width: '100%', padding: '6px 0', background: '#1a1a3a', border: '1px solid #60a5fa', color: '#60a5fa', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}
        >
          📂 로컬 영상 바로 추가
        </button>
      </div>
    </div>
  );
};
