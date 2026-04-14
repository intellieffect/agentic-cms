'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';
import type { ClipZoom } from './types';

export const ClipPanel: React.FC = () => {
  const selectedClipIndex = useEditorStore((s) => s.selectedClipIndex);
  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const clipCrops = useEditorStore((s) => s.clipCrops);
  const clipZooms = useEditorStore((s) => s.clipZooms);
  const updateClip = useEditorStore((s) => s.updateClip);
  const updateClipMeta = useEditorStore((s) => s.updateClipMeta);
  const setAllClipAudioMuted = useEditorStore((s) => s.setAllClipAudioMuted);
  const updateClipCrop = useEditorStore((s) => s.updateClipCrop);
  const updateClipZoom = useEditorStore((s) => s.updateClipZoom);
  const splitClip = useEditorStore((s) => s.splitClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const replaceClipSource = useEditorStore((s) => s.replaceClipSource);

  const [sourceDuration, setSourceDuration] = useState(0);
  const [splitTime, setSplitTime] = useState<number | null>(null);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showCrop, setShowCrop] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [showOpacity, setShowOpacity] = useState(false);
  const [showRotation, setShowRotation] = useState(false);
  const [showAlign, setShowAlign] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const clip = selectedClipIndex >= 0 && selectedClipIndex < clips.length ? clips[selectedClipIndex] : null;
  const meta = clip ? (clipMeta[selectedClipIndex] || { speed: 1 }) : { speed: 1 };
  const crop = clip ? (clipCrops[selectedClipIndex] || { x: 0, y: 0, w: 100, h: 100 }) : { x: 0, y: 0, w: 100, h: 100 };
  const zoom = clip ? (clipZooms[selectedClipIndex] || { scale: 1, panX: 0, panY: 0 }) : { scale: 1, panX: 0, panY: 0 };
  const opacity = meta.opacity ?? 100;
  const rotation = meta.rotation ?? 0;
  const clipVolume = meta.volume ?? 100;
  const isAudioMuted = meta.audioMuted ?? false;
  const allClipAudioMuted = clips.length > 0 && clips.every((_, i) => clipMeta[i]?.audioMuted ?? false);
  const fitMode = meta.fitMode ?? 'cover';
  const posX = meta.positionX ?? 50;
  const posY = meta.positionY ?? 50;

  // 소스 영상 전체 길이 프로브
  useEffect(() => {
    if (!clip) return;
    fetch(`${getEditorConfig().apiUrl}/api/media/probe/${encodeURIComponent(clip.source)}`)
      .then(r => r.json())
      .then(d => setSourceDuration(d.duration || clip.end + 10))
      .catch(() => setSourceDuration(clip.end + 10));
  }, [clip?.source]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!clip) {
    return (
      <div style={{ padding: 12, color: '#555', fontSize: 11 }}>
        타임라인에서 클립을 선택하세요
      </div>
    );
  }

  const clipDuration = (clip.end - clip.start) / meta.speed;
  const barTotal = sourceDuration || clip.end + 5;
  const barStartPct = (clip.start / barTotal) * 100;
  const barWidthPct = ((clip.end - clip.start) / barTotal) * 100;

  // 구간 바 드래그
  const handleBarMouseDown = (e: React.MouseEvent, type: 'left' | 'right' | 'move') => {
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const startX = e.clientX;
    const origStart = clip.start;
    const origEnd = clip.end;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dt = (dx / rect.width) * barTotal;
      if (type === 'left') {
        updateClip(selectedClipIndex, { start: Math.max(0, Math.min(origEnd - 0.1, origStart + dt)) });
      } else if (type === 'right') {
        updateClip(selectedClipIndex, { end: Math.max(origStart + 0.1, Math.min(barTotal, origEnd + dt)) });
      } else {
        const dur = origEnd - origStart;
        const newStart = Math.max(0, Math.min(barTotal - dur, origStart + dt));
        updateClip(selectedClipIndex, { start: newStart, end: newStart + dur });
      }
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const btnStyle: React.CSSProperties = {
    background: '#222', border: '1px solid #444', color: '#ddd',
    borderRadius: 4, width: 24, height: 24, cursor: 'pointer',
    fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#888' }}>📎 #{selectedClipIndex + 1} / {clips.length}</span>
        <button
          onClick={() => removeClip(selectedClipIndex)}
          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}
        >🗑</button>
      </div>

      {/* 소스 + 변경 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#666' }}>소스</span>
        <span style={{ flex: 1, fontSize: 10, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.source}</span>
        <button
          onClick={async () => {
            try {
              const r = await fetch(`${getEditorConfig().apiUrl}/api/resolver/pick-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: '영상' }),
              });
              if (!r.ok) return;
              const d = await r.json();
              if (!d.filepath) return;
              const fname = d.filepath.split('/').pop() || 'video.mp4';
              await fetch(`${getEditorConfig().apiUrl}/api/resolver/link-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: fname, filepath: d.filepath }),
              });
              let duration = 10;
              try {
                const pr = await fetch(`${getEditorConfig().apiUrl}/api/media/probe/${encodeURIComponent(fname)}`);
                if (pr.ok) { const pd = await pr.json(); duration = pd.duration || 10; }
              } catch {}
              replaceClipSource(selectedClipIndex, fname, duration);
            } catch {}
          }}
          style={{ background: '#1a1a1a', border: '1px solid #444', color: '#60a5fa', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9, whiteSpace: 'nowrap' }}
        >🔄 변경</button>
      </div>

      {/* 시작/끝 입력 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#666', width: 24 }}>시작</span>
        <input
          type="number" min={0} max={clip.end - 0.1} step={0.1} value={Number(clip.start.toFixed(1))}
          onChange={(e) => updateClip(selectedClipIndex, { start: Math.max(0, Math.min(clip.end - 0.1, Number(e.target.value))) })}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#ddd', padding: '5px 8px', borderRadius: 4, fontSize: 11 }}
        />
        <span style={{ fontSize: 9, color: '#666', width: 16 }}>끝</span>
        <input
          type="number" min={clip.start + 0.1} step={0.1} value={Number(clip.end.toFixed(1))}
          onChange={(e) => updateClip(selectedClipIndex, { end: Math.max(clip.start + 0.1, Number(e.target.value)) })}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#ddd', padding: '5px 8px', borderRadius: 4, fontSize: 11 }}
        />
      </div>

      {/* 시각적 구간 바 */}
      <div
        ref={barRef}
        style={{ position: 'relative', height: 32, background: '#222', borderRadius: 4, overflow: 'hidden', cursor: 'default' }}
      >
        <div
          onMouseDown={(e) => handleBarMouseDown(e, 'move')}
          style={{
            position: 'absolute',
            left: `${barStartPct}%`,
            width: `${barWidthPct}%`,
            top: 0, bottom: 0,
            background: 'linear-gradient(135deg, #c2742f, #e8954a)',
            borderRadius: 4,
            cursor: 'grab',
            border: '2px solid #e8954a',
            minWidth: 8,
          }}
        >
          <div
            onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, 'left'); }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '4px 0 0 4px' }}
          />
          <div
            onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, 'right'); }}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', background: 'rgba(255,255,255,0.3)', borderRadius: '0 4px 4px 0' }}
          />
        </div>
      </div>

      {/* 타임코드 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#666' }}>
        <span>{fmtTime(clip.start)}</span>
        <span>{meta.speed}x</span>
        <span>{fmtTime(sourceDuration)}</span>
      </div>

      {/* 길이 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
        <span style={{ color: '#666' }}>길이</span>
        <span style={{ color: '#ddd', fontWeight: 600 }}>{clipDuration.toFixed(1)}s</span>
      </div>

      {/* 블레이드 */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: '#666', whiteSpace: 'nowrap' }}>분할 지점</span>
        <input
          type="number"
          min={clip.start + 0.1}
          max={clip.end - 0.1}
          step={0.1}
          value={splitTime ?? Number(((clip.start + clip.end) / 2).toFixed(1))}
          onChange={(e) => setSplitTime(Number(e.target.value))}
          style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#ddd', padding: '4px 6px', borderRadius: 4, fontSize: 10 }}
        />
        <span style={{ fontSize: 8, color: '#555' }}>s</span>
      </div>
      <button
        onClick={() => {
          const t = splitTime ?? (clip.start + clip.end) / 2;
          splitClip(selectedClipIndex, t);
          setSplitTime(null);
        }}
        style={{ width: '100%', padding: '5px 0', background: '#1a1a1a', border: '1px solid #333', color: '#ddd', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}
      >✂️ 클립 분할</button>

      {/* 속도 (접이식) */}
      <div
        onClick={() => setShowSpeed(!showSpeed)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showSpeed ? '▼' : '▶'}</span> ⚡ 속도
      </div>
      {showSpeed && (
        <div style={{ paddingLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
            <button onClick={() => updateClipMeta(selectedClipIndex, { speed: Math.max(0.25, meta.speed - 0.25) })}
              style={{ background: '#222', border: '1px solid #444', color: '#ddd', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 12 }}>−</button>
            <span style={{ color: '#ddd', minWidth: 24, textAlign: 'center' }}>{meta.speed}x</span>
            <button onClick={() => updateClipMeta(selectedClipIndex, { speed: Math.min(4, meta.speed + 0.25) })}
              style={{ background: '#222', border: '1px solid #444', color: '#ddd', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 12 }}>+</button>
            <button onClick={() => updateClipMeta(selectedClipIndex, { speed: 1 })}
              style={{ background: '#222', border: '1px solid #444', color: '#888', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 9 }}>맞춤</button>
          </div>
        </div>
      )}

      {/* 크롭 (접이식) */}
      <div
        onClick={() => setShowCrop(!showCrop)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showCrop ? '▼' : '▶'}</span> 🔲 크롭
      </div>
      {showCrop && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 8 }}>
          {(['x', 'y', 'w', 'h'] as const).map((key) => (
            <div key={key}>
              <label style={{ fontSize: 9, color: '#555' }}>{key.toUpperCase()}: {crop[key]}%</label>
              <input type="range" min={0} max={100} value={crop[key]}
                onChange={(e) => updateClipCrop(selectedClipIndex, { [key]: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }} />
            </div>
          ))}
        </div>
      )}

      {/* 줌 (접이식) */}
      <div
        onClick={() => setShowZoom(!showZoom)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showZoom ? '▼' : '▶'}</span> 🔍 줌
      </div>
      {showZoom && (
        <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* 줌 애니메이션 프리셋 */}
          <div>
            <label style={{ fontSize: 9, color: '#555' }}>🎬 줌 애니메이션</label>
            <select
              value={zoom.animation || 'none'}
              onChange={(e) => updateClipZoom(selectedClipIndex, { animation: e.target.value as ClipZoom['animation'] })}
              className="filter-select"
              style={{ width: '100%', marginTop: 2 }}
            >
              <option value="none">없음 (정적)</option>
              <option value="zoomIn">줌 인 (확대)</option>
              <option value="zoomOut">줌 아웃 (축소)</option>
              <option value="panLeft">팬 ← (왼쪽 이동)</option>
              <option value="panRight">팬 → (오른쪽 이동)</option>
              <option value="panUp">팬 ↑ (위로 이동)</option>
              <option value="panDown">팬 ↓ (아래로 이동)</option>
              <option value="custom">커스텀 (시작→끝 직접 설정)</option>
            </select>
          </div>
          {zoom.animation && zoom.animation !== 'none' && zoom.animation !== 'custom' && (
            <div style={{ fontSize: 9, color: '#7c3aed', padding: '2px 0' }}>
              ✓ {
                { zoomIn: '줌 인 — 재생하면서 점점 확대', zoomOut: '줌 아웃 — 재생하면서 점점 축소',
                  panLeft: '왼쪽 팬 — 오른쪽→왼쪽 이동', panRight: '오른쪽 팬 — 왼쪽→오른쪽 이동',
                  panUp: '위로 팬 — 아래→위 이동', panDown: '아래로 팬 — 위→아래 이동',
                }[zoom.animation]
              }
            </div>
          )}
          {zoom.animation === 'custom' && (
            <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 8, color: '#666' }}>시작 → 끝 값 (클립 재생 동안 보간)</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div>
                  <label style={{ fontSize: 8, color: '#555' }}>Scale 시작: {zoom.scale.toFixed(1)}</label>
                  <input type="range" min={0.5} max={3} step={0.1} value={zoom.scale}
                    onChange={(e) => updateClipZoom(selectedClipIndex, { scale: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#555' }}>Scale 끝: {(zoom.scaleEnd ?? zoom.scale).toFixed(1)}</label>
                  <input type="range" min={0.5} max={3} step={0.1} value={zoom.scaleEnd ?? zoom.scale}
                    onChange={(e) => updateClipZoom(selectedClipIndex, { scaleEnd: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#555' }}>PanX 시작: {zoom.panX}%</label>
                  <input type="range" min={-50} max={50} value={zoom.panX}
                    onChange={(e) => updateClipZoom(selectedClipIndex, { panX: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#555' }}>PanX 끝: {(zoom.panXEnd ?? zoom.panX)}%</label>
                  <input type="range" min={-50} max={50} value={zoom.panXEnd ?? zoom.panX}
                    onChange={(e) => updateClipZoom(selectedClipIndex, { panXEnd: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#555' }}>PanY 시작: {zoom.panY}%</label>
                  <input type="range" min={-50} max={50} value={zoom.panY}
                    onChange={(e) => updateClipZoom(selectedClipIndex, { panY: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#555' }}>PanY 끝: {(zoom.panYEnd ?? zoom.panY)}%</label>
                  <input type="range" min={-50} max={50} value={zoom.panYEnd ?? zoom.panY}
                    onChange={(e) => updateClipZoom(selectedClipIndex, { panYEnd: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: '#7c3aed' }} />
                </div>
              </div>
            </div>
          )}
          <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 4 }}>
            <label style={{ fontSize: 9, color: '#555' }}>기본 Scale: {zoom.scale.toFixed(1)}</label>
            <input type="range" min={0.5} max={3} step={0.1} value={zoom.scale}
              onChange={(e) => updateClipZoom(selectedClipIndex, { scale: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#2563eb' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <label style={{ fontSize: 9, color: '#555' }}>Pan X: {zoom.panX}%</label>
              <input type="range" min={-50} max={50} value={zoom.panX}
                onChange={(e) => updateClipZoom(selectedClipIndex, { panX: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }} />
            </div>
            <div>
              <label style={{ fontSize: 9, color: '#555' }}>Pan Y: {zoom.panY}%</label>
              <input type="range" min={-50} max={50} value={zoom.panY}
                onChange={(e) => updateClipZoom(selectedClipIndex, { panY: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }} />
            </div>
          </div>
        </div>
      )}

      {/* Clip Position (가로 영상 위치 조절, 접이식) */}
      <div
        onClick={() => setShowPosition(!showPosition)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showPosition ? '▼' : '▶'}</span> 🎯 영상 위치
      </div>
      {showPosition && (
        <div style={{ paddingLeft: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: '#666' }}>세로 화면 배치 방식</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => updateClipMeta(selectedClipIndex, { fitMode: 'cover', positionX: 50, positionY: 50 })}
                style={{ flex: 1, background: fitMode === 'cover' ? '#2563eb' : '#222', border: '1px solid #444', color: fitMode === 'cover' ? '#fff' : '#888', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', fontSize: 9 }}
              >
                1. 세로 채우기
              </button>
              <button
                onClick={() => updateClipMeta(selectedClipIndex, { fitMode: 'contain', positionX: 50, positionY: 50 })}
                style={{ flex: 1, background: fitMode === 'contain' ? '#2563eb' : '#222', border: '1px solid #444', color: fitMode === 'contain' ? '#fff' : '#888', borderRadius: 4, padding: '4px 6px', cursor: 'pointer', fontSize: 9 }}
              >
                2. 가로 맞춤
              </button>
            </div>
            <div style={{ fontSize: 8, color: '#666', lineHeight: 1.4 }}>
              {fitMode === 'contain'
                ? '가로 길이 기준으로 중앙 표시, 위아래 검은 여백'
                : '세로 길이 기준으로 꽉 채우기, 좌우 크롭'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#888', minWidth: 20 }}>좌우</span>
            <input type="range" min={0} max={100} step={1} value={posX}
              onChange={(e) => updateClipMeta(selectedClipIndex, { positionX: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#2563eb' }} />
            <span style={{ fontSize: 10, color: '#ddd', minWidth: 30, textAlign: 'right' }}>{posX}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#888', minWidth: 20 }}>상하</span>
            <input type="range" min={0} max={100} step={1} value={posY}
              onChange={(e) => updateClipMeta(selectedClipIndex, { positionY: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#2563eb' }} />
            <span style={{ fontSize: 10, color: '#ddd', minWidth: 30, textAlign: 'right' }}>{posY}%</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => updateClipMeta(selectedClipIndex, { positionX: 0 })}
              style={{ background: posX === 0 ? '#2563eb' : '#222', border: '1px solid #444', color: posX === 0 ? '#fff' : '#888', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9 }}
            >◀ 왼쪽</button>
            <button
              onClick={() => updateClipMeta(selectedClipIndex, { positionX: 50, positionY: 50 })}
              style={{ background: (posX === 50 && posY === 50) ? '#2563eb' : '#222', border: '1px solid #444', color: (posX === 50 && posY === 50) ? '#fff' : '#888', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9 }}
            >● 가운데</button>
            <button
              onClick={() => updateClipMeta(selectedClipIndex, { positionX: 100 })}
              style={{ background: posX === 100 ? '#2563eb' : '#222', border: '1px solid #444', color: posX === 100 ? '#fff' : '#888', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9 }}
            >▶ 오른쪽</button>
          </div>
        </div>
      )}

      {/* Clip Audio Volume (접이식) */}
      <div
        onClick={() => setShowVolume(!showVolume)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showVolume ? '▼' : '▶'}</span> 🔊 영상 소리
      </div>
      {showVolume && (
        <div style={{ paddingLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: '#666' }}>클립 오디오</span>
            <button
              onClick={() => updateClipMeta(selectedClipIndex, { audioMuted: !isAudioMuted })}
              style={{
                background: isAudioMuted ? '#3a1a1a' : '#1a3a2a',
                border: `1px solid ${isAudioMuted ? '#ef4444' : '#10b981'}`,
                color: isAudioMuted ? '#fca5a5' : '#a7f3d0',
                borderRadius: 4,
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: 9,
              }}
            >
              {isAudioMuted ? '🔇 꺼짐' : '🔊 켜짐'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: isAudioMuted ? 0.45 : 1 }}>
            <input type="range" min={0} max={100} step={1} value={clipVolume}
              onChange={(e) => updateClipMeta(selectedClipIndex, { volume: Number(e.target.value), audioMuted: false })}
              style={{ flex: 1, accentColor: '#2563eb' }} />
            <span style={{ fontSize: 10, color: '#ddd', minWidth: 30, textAlign: 'right' }}>{clipVolume}%</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              onClick={() => updateClipMeta(selectedClipIndex, { audioMuted: true })}
              style={{ background: isAudioMuted ? '#2563eb' : '#222', border: '1px solid #444', color: isAudioMuted ? '#fff' : '#888', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 9 }}
            >🔇 음소거</button>
            <button
              onClick={() => updateClipMeta(selectedClipIndex, { volume: 100, audioMuted: false })}
              style={{ background: '#222', border: '1px solid #444', color: '#888', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 9 }}
            >↺ 초기화</button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button
              onClick={() => setAllClipAudioMuted(true)}
              style={{ flex: 1, background: allClipAudioMuted ? '#2563eb' : '#222', border: '1px solid #444', color: allClipAudioMuted ? '#fff' : '#888', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 9 }}
            >
              전체 음소거
            </button>
            <button
              onClick={() => setAllClipAudioMuted(false)}
              style={{ flex: 1, background: !allClipAudioMuted ? '#2563eb' : '#222', border: '1px solid #444', color: !allClipAudioMuted ? '#fff' : '#888', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: 9 }}
            >
              전체 켜기
            </button>
          </div>
        </div>
      )}

      {/* Feature 9: Opacity (접이식) */}
      <div
        onClick={() => setShowOpacity(!showOpacity)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showOpacity ? '▼' : '▶'}</span> 🔆 불투명도
      </div>
      {showOpacity && (
        <div style={{ paddingLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="range" min={0} max={100} step={1} value={opacity}
              onChange={(e) => updateClipMeta(selectedClipIndex, { opacity: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#2563eb' }} />
            <span style={{ fontSize: 10, color: '#ddd', minWidth: 30, textAlign: 'right' }}>{opacity}%</span>
          </div>
        </div>
      )}

      {/* Feature 9: Rotation (접이식) */}
      <div
        onClick={() => setShowRotation(!showRotation)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showRotation ? '▼' : '▶'}</span> 🔄 회전
      </div>
      {showRotation && (
        <div style={{ paddingLeft: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="range" min={-360} max={360} step={1} value={rotation}
              onChange={(e) => updateClipMeta(selectedClipIndex, { rotation: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#2563eb' }} />
            <input
              type="number" min={-360} max={360} step={1} value={rotation}
              onChange={(e) => updateClipMeta(selectedClipIndex, { rotation: Math.max(-360, Math.min(360, Number(e.target.value))) })}
              style={{ width: 50, background: '#1a1a1a', border: '1px solid #333', color: '#ddd', padding: '3px 6px', borderRadius: 4, fontSize: 10, textAlign: 'right' }}
            />
            <span style={{ fontSize: 9, color: '#666' }}>°</span>
          </div>
          <button
            onClick={() => updateClipMeta(selectedClipIndex, { rotation: 0 })}
            style={{ marginTop: 4, background: '#222', border: '1px solid #444', color: '#888', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 9 }}
          >초기화</button>
        </div>
      )}

      {/* Feature 10: Alignment (접이식) */}
      <div
        onClick={() => setShowAlign(!showAlign)}
        style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <span style={{ fontSize: 8 }}>{showAlign ? '▼' : '▶'}</span> 📐 정렬
      </div>
      {showAlign && (
        <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <span style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 4 }}>가로 정렬</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => updateClipZoom(selectedClipIndex, { panX: -50 + (50 / zoom.scale) })}
                style={btnStyle}
                title="왼쪽 정렬"
              >◀</button>
              <button
                onClick={() => updateClipZoom(selectedClipIndex, { panX: 0 })}
                style={btnStyle}
                title="가운데 정렬"
              >◆</button>
              <button
                onClick={() => updateClipZoom(selectedClipIndex, { panX: 50 - (50 / zoom.scale) })}
                style={btnStyle}
                title="오른쪽 정렬"
              >▶</button>
            </div>
          </div>
          <div>
            <span style={{ fontSize: 9, color: '#555', display: 'block', marginBottom: 4 }}>세로 정렬</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => updateClipZoom(selectedClipIndex, { panY: -50 + (50 / zoom.scale) })}
                style={btnStyle}
                title="상단 정렬"
              >▲</button>
              <button
                onClick={() => updateClipZoom(selectedClipIndex, { panY: 0 })}
                style={btnStyle}
                title="중앙 정렬"
              >◆</button>
              <button
                onClick={() => updateClipZoom(selectedClipIndex, { panY: 50 - (50 / zoom.scale) })}
                style={btnStyle}
                title="하단 정렬"
              >▼</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
