'use client';

import React, { useState, useCallback, useRef } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';

interface AnalyzeResult {
  score: number;
  start: number;
  duration: number;
  reason: string;
}

export const BgmPanel: React.FC = () => {
  const bgmClips = useEditorStore((s) => s.bgmClips);
  const totalDuration = useEditorStore((s) => s.totalDuration);
  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const transitions = useEditorStore((s) => s.transitions);
  const addBgmClip = useEditorStore((s) => s.addBgmClip);
  const removeBgmClip = useEditorStore((s) => s.removeBgmClip);
  const updateBgmClip = useEditorStore((s) => s.updateBgmClip);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [analyzeResults, setAnalyzeResults] = useState<AnalyzeResult[]>([]);
  const [activeAnalyzeIdx, setActiveAnalyzeIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const r = await fetch(`${getEditorConfig().apiUrl}/api/upload`, { method: 'POST', body: formData });
        if (r.ok) {
          addBgmClip({
            source: file.name,
            start: 0,
            audioStart: 0,
            duration: totalDuration || 30,
            volume: 30,
          });
        }
      } catch {
        // ignore
      }
    }
    setUploading(false);
  }, [addBgmClip, totalDuration]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload]);

  const handleAnalyze = useCallback(async (bgmIndex: number) => {
    const bgm = bgmClips[bgmIndex];
    if (!bgm) return;
    setAnalyzing(bgmIndex);
    setActiveAnalyzeIdx(bgmIndex);
    setAnalyzeResults([]);
    try {
      // Build clipBoundaries and clipsData from current timeline
      const clipBoundaries: number[] = [0];
      let cursor = 0;
      const clipsData = clips.map((c, i) => {
        const speed = clipMeta[i]?.speed ?? 1;
        const dur = (c.end - c.start) / speed;
        cursor += dur;
        const t = transitions[i];
        if (t && t.type !== 'none' && t.duration > 0) cursor -= t.duration;
        clipBoundaries.push(cursor);
        return { source: c.source, start: c.start, end: c.end, speed };
      });

      const r = await fetch(`${getEditorConfig().apiUrl}/api/bgm/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: bgm.source,
          videoDuration: totalDuration || 30,
          targetDuration: totalDuration || 30,
          clipBoundaries,
          clipsData,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setAnalyzeResults(data.results || data.sections || []);
      }
    } catch {
      // ignore
    }
    setAnalyzing(null);
  }, [bgmClips, clips, clipMeta, transitions, totalDuration]);

  const applyAnalyzeResult = (bgmIndex: number, result: AnalyzeResult) => {
    updateBgmClip(bgmIndex, {
      audioStart: result.start,
      duration: result.duration,
    });
  };

  return (
    <div className="studio-panel-content studio-panel-content-bgm" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="studio-panel-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
          BGM ({bgmClips.length})
        </div>
      </div>

      {/* Upload area */}
      <div
        className="studio-upload-card"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#10b981' : '#333'}`,
          borderRadius: 6,
          padding: '10px 8px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? '#10b98111' : 'transparent',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 11, color: dragOver ? '#10b981' : '#666' }}>
          {uploading ? '업로드 중...' : 'BGM 파일 드래그 또는 클릭'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
      </div>

      {bgmClips.length === 0 && (
        <div className="studio-card" style={{ color: '#555', fontSize: 11, textAlign: 'center', padding: 8 }}>
          BGM 트랙 없음
        </div>
      )}

      {bgmClips.map((bgm, i) => (
        <div key={bgm.id || i} className="studio-card studio-audio-card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: '#1a1a1a', borderRadius: 6, border: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="studio-audio-title" style={{ fontSize: 10, color: '#a7f3d0', fontWeight: 600 }}>
              {bgm.source}
            </div>
            <button
              className="be-btn"
              style={{ fontSize: 9, padding: '1px 5px', color: '#ef4444', borderColor: '#ef444444' }}
              onClick={() => removeBgmClip(i)}
            >
              삭제
            </button>
          </div>
          {bgm.sectionType && (
            <span className="tag">{bgm.sectionType}</span>
          )}

          {/* Volume */}
          <label style={{ fontSize: 9, color: '#666' }}>볼륨: {bgm.volume}</label>
          <input
            type="range"
            min={0}
            max={100}
            value={bgm.volume}
            onChange={(e) => updateBgmClip(i, { volume: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981' }}
          />

          {/* Audio start */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 9, color: '#666', whiteSpace: 'nowrap' }}>음원 시작</label>
            <input
              type="number"
              step={0.1}
              min={0}
              max={bgm.totalDuration || 300}
              value={bgm.audioStart}
              onChange={(e) => updateBgmClip(i, { audioStart: Number(e.target.value) })}
              style={{ width: 60, background: '#222', border: '1px solid #333', borderRadius: 3, color: '#ccc', padding: '2px 4px', fontSize: 10 }}
            />
            <span style={{ fontSize: 8, color: '#555' }}>s{bgm.totalDuration ? ` / ${bgm.totalDuration.toFixed(1)}s` : ''}</span>
          </div>
          <input
            type="range"
            min={0}
            max={bgm.totalDuration || 300}
            step={0.1}
            value={bgm.audioStart}
            onChange={(e) => updateBgmClip(i, { audioStart: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981' }}
          />

          {/* Duration */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label style={{ fontSize: 9, color: '#666', whiteSpace: 'nowrap' }}>사용 길이</label>
            <input
              type="number"
              step={0.1}
              min={0.5}
              max={bgm.totalDuration || 300}
              value={bgm.duration}
              onChange={(e) => updateBgmClip(i, { duration: Number(e.target.value) })}
              style={{ width: 60, background: '#222', border: '1px solid #333', borderRadius: 3, color: '#ccc', padding: '2px 4px', fontSize: 10 }}
            />
            <span style={{ fontSize: 8, color: '#555' }}>s</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={bgm.totalDuration || 300}
            step={0.1}
            value={bgm.duration}
            onChange={(e) => updateBgmClip(i, { duration: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981' }}
          />

          {/* Auto analyze */}
          <button
            className="be-btn"
            style={{ fontSize: 10, padding: '4px 8px' }}
            onClick={() => handleAnalyze(i)}
            disabled={analyzing === i}
          >
            {analyzing === i ? '분석 중...' : '자동 구간 찾기'}
          </button>

          {/* Analyze results */}
          {activeAnalyzeIdx === i && analyzeResults.length > 0 && (
            <div className="studio-result-list" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' }}>
              {analyzeResults.map((result, ri) => (
                <div
                  className="studio-result-item"
                  key={ri}
                  onClick={() => applyAnalyzeResult(i, result)}
                  style={{
                    padding: '4px 6px',
                    background: '#111',
                    border: '1px solid #2a2a2a',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 9,
                    color: '#aaa',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#10b981'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 40, height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (result.score / 10) * 100)}%`, height: '100%', background: '#10b981', borderRadius: 3 }} />
                      </div>
                      <span style={{ color: '#10b981', fontSize: 9 }}>{result.score}</span>
                    </div>
                    <span>{result.start.toFixed(1)}s ~ {(result.start + result.duration).toFixed(1)}s</span>
                  </div>
                  {result.reason && <div style={{ color: '#666', marginTop: 2 }}>{result.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
