'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';
import type { Clip } from './types';
import { NUM_VIDEO_TRACKS } from './types';

import { FPS, TRACK_HEIGHT, CLIP_AUDIO_TRACK_HEIGHT, HEADER_W, TRIM_HANDLE_W } from './timeline/constants';
import { useWaveform } from './timeline/useWaveform';
import { useKeyboardShortcuts } from './timeline/useKeyboardShortcuts';
import { useDrag } from './timeline/useDrag';

export const Timeline: React.FC = () => {
  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const transitions = useEditorStore((s) => s.transitions);
  const globalSubs = useEditorStore((s) => s.globalSubs);
  const bgmClips = useEditorStore((s) => s.bgmClips);
  const totalDuration = useEditorStore((s) => s.totalDuration);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const selectedClipIndex = useEditorStore((s) => s.selectedClipIndex);
  const selectedClipIndices = useEditorStore((s) => s.selectedClipIndices);
  const selectedSubIndex = useEditorStore((s) => s.selectedSubIndex);
  const pxPerSec = useEditorStore((s) => s.pxPerSec);
  const setSelectedClipIndex = useEditorStore((s) => s.setSelectedClipIndex);
  const toggleClipSelection = useEditorStore((s) => s.toggleClipSelection);
  const selectClipRange = useEditorStore((s) => s.selectClipRange);
  const setSelectedSubIndex = useEditorStore((s) => s.setSelectedSubIndex);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const setPxPerSec = useEditorStore((s) => s.setPxPerSec);
  const subsEnabled = useEditorStore((s) => s.subsEnabled);
  const bgmEnabled = useEditorStore((s) => s.bgmEnabled);
  const removeClip = useEditorStore((s) => s.removeClip);
  const removeSubtitle = useEditorStore((s) => s.removeSubtitle);
  const updateClipMeta = useEditorStore((s) => s.updateClipMeta);
  const setAllClipAudioMuted = useEditorStore((s) => s.setAllClipAudioMuted);
  const splitClip = useEditorStore((s) => s.splitClip);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const addClip = useEditorStore((s) => s.addClip);

  const [fileDragOver, setFileDragOver] = useState(false);
  const [selectedBgmIndex, setSelectedBgmIndex] = useState(-1);

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Calculate clip positions on timeline
  const clipDurations = clips.map((clip, i) => {
    const speed = clipMeta[i]?.speed ?? 1;
    return (clip.end - clip.start) / speed;
  });

  const clipStarts: number[] = [0];
  for (let i = 1; i < clips.length; i++) {
    const prevEnd = clipStarts[i - 1] + clipDurations[i - 1];
    const t = transitions[i - 1];
    const overlap = t && t.type !== 'none' && t.duration > 0 ? t.duration : 0;
    clipStarts.push(prevEnd - overlap);
  }

  const timelineWidth = Math.max(totalDuration * pxPerSec + 100, 400);
  const currentTime = currentFrame / FPS;
  const allClipAudioMuted = clips.length > 0 && clips.every((_, i) => clipMeta[i]?.audioMuted ?? false);

  // Waveform hook
  const { bgmWaveformDurations, clipAudioInfo, waveformVersion, drawBgmWaveform, drawClipWaveform } = useWaveform();

  // Drag hook
  const { dragMode, dragIndex, dragOffsetSec, snapLineX, startDrag, handleTimelineClick, getTimeFromX } = useDrag({
    clipStarts,
    clipDurations,
    trackRef,
    bgmWaveformDurations,
  });

  // Keyboard shortcuts hook
  useKeyboardShortcuts(selectedBgmIndex, setSelectedBgmIndex);

  // File drop handler
  const handleFileDrop = useCallback(async (files: FileList) => {
    const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!videoExts.includes(ext)) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        let uploadOk = false;
        try {
          const res = await fetch(`${getEditorConfig().apiUrl}/api/upload`, { method: 'POST', body: formData });
          uploadOk = res.ok;
        } catch { /* ignore */ }
        if (!uploadOk) {
          const formData2 = new FormData();
          formData2.append('file', file);
          const res2 = await fetch(`${getEditorConfig().apiUrl}/api/upload`, { method: 'POST', body: formData2 });
          uploadOk = res2.ok;
        }
        if (!uploadOk) continue;
        let duration = 10;
        for (let retry = 0; retry < 3; retry++) {
          try {
            const pr = await fetch(`${getEditorConfig().apiUrl}/api/media/probe/${encodeURIComponent(file.name)}`);
            if (pr.ok) {
              const pd = await pr.json();
              if (pd.duration && pd.duration > 0) { duration = pd.duration; break; }
            }
          } catch { /* ignore */ }
          await new Promise((r) => setTimeout(r, 500));
        }
        addClip({ source: file.name, start: 0, end: duration, source_idx: 0 } as Clip);
      } catch {
        // ignore
      }
    }
  }, [addClip]);

  // Playhead auto-follow during playback
  useEffect(() => {
    if (!isPlaying || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const playheadX = currentTime * pxPerSec;
    const scrollLeft = container.scrollLeft;
    const clientWidth = container.clientWidth - HEADER_W;
    const visibleLeft = scrollLeft;
    const visibleRight = scrollLeft + clientWidth;

    if (playheadX < visibleLeft || playheadX > visibleRight) {
      container.scrollLeft = Math.max(0, playheadX - clientWidth / 2);
    }
  }, [isPlaying, currentFrame, currentTime, pxPerSec]);

  // Zoom with scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -10 : 10;
      setPxPerSec(pxPerSec + delta);
    }
  }, [pxPerSec, setPxPerSec]);

  // Context menu for clip split
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; clipIdx: number; splitTime: number } | null>(null);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const colors = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

  const trimHandleStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    [side]: 0,
    top: 0,
    bottom: 0,
    width: TRIM_HANDLE_W,
    cursor: 'ew-resize',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: side === 'left' ? '3px 0 0 3px' : '0 3px 3px 0',
    zIndex: 2,
  });

  // Subtitle lane assignment
  const subtitleLanes: number[] = [];
  const subtitleLaneEnds: number[] = [];
  for (let i = 0; i < globalSubs.length; i++) {
    const sub = globalSubs[i];
    let assigned = -1;
    for (let lane = 0; lane < subtitleLaneEnds.length; lane++) {
      if (sub.start >= subtitleLaneEnds[lane] - 0.01) {
        assigned = lane;
        subtitleLaneEnds[lane] = sub.end;
        break;
      }
    }
    if (assigned === -1) {
      assigned = subtitleLaneEnds.length;
      subtitleLaneEnds.push(sub.end);
    }
    subtitleLanes.push(assigned);
  }
  const subtitleLaneCount = Math.max(1, subtitleLaneEnds.length);
  const subtitleLaneHeight = Math.max(14, (TRACK_HEIGHT - 4) / subtitleLaneCount);
  const subtitleTrackHeight = Math.max(TRACK_HEIGHT, subtitleLaneCount * subtitleLaneHeight + 4);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setFileDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setFileDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setFileDragOver(false); if (e.dataTransfer.files.length > 0) handleFileDrop(e.dataTransfer.files); }}
      style={{
        background: '#111',
        borderTop: fileDragOver ? '2px dashed #60a5fa' : '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        userSelect: dragMode ? 'none' : undefined,
        position: 'relative',
      }}
      onWheel={handleWheel}
    >
      {fileDragOver && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(96,165,250,0.08)',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          <span style={{ color: '#60a5fa', fontSize: 14, fontWeight: 600 }}>타임라인에 영상 추가</span>
        </div>
      )}
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <button
          className="be-btn"
          style={{ fontSize: 9, padding: '2px 6px', opacity: canUndo() ? 1 : 0.3 }}
          onClick={() => undo()}
          disabled={!canUndo()}
          title="실행 취소 (Cmd+Z)"
        >↩</button>
        <button
          className="be-btn"
          style={{ fontSize: 9, padding: '2px 6px', opacity: canRedo() ? 1 : 0.3 }}
          onClick={() => redo()}
          disabled={!canRedo()}
          title="다시 실행 (Cmd+Shift+Z)"
        >↪</button>
        <div style={{ width: 1, height: 12, background: '#333', margin: '0 2px' }} />
        <button className="be-btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => setPxPerSec(pxPerSec - 20)}>-</button>
        <span style={{ fontSize: 9, color: '#555', minWidth: 32, textAlign: 'center' }}>{pxPerSec}px/s</span>
        <button className="be-btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => setPxPerSec(pxPerSec + 20)}>+</button>
        <button
          className="be-btn"
          style={{ fontSize: 9, padding: '2px 6px' }}
          onClick={() => {
            if (totalDuration > 0 && trackRef.current) {
              const availW = trackRef.current.clientWidth - 20;
              setPxPerSec(Math.max(20, Math.min(400, availW / totalDuration)));
            }
          }}
          title="Shift+Z"
        >Fit</button>
        <div style={{ width: 1, height: 12, background: '#333', margin: '0 2px' }} />
        <button
          className="be-btn"
          style={{ fontSize: 9, padding: '2px 6px' }}
          title="플레이헤드 위치에서 클립 분할 (B)"
          onClick={() => {
            let cursor = 0;
            for (let ci = 0; ci < clips.length; ci++) {
              const speed = clipMeta[ci]?.speed ?? 1;
              const dur = (clips[ci].end - clips[ci].start) / speed;
              if (currentTime >= cursor && currentTime < cursor + dur) {
                const splitAt = clips[ci].start + (currentTime - cursor) * speed;
                if (splitAt > clips[ci].start + 0.1 && splitAt < clips[ci].end - 0.1) {
                  splitClip(ci, splitAt);
                }
                break;
              }
              cursor += dur;
            }
          }}
        >✂️</button>
        <div style={{ width: 1, height: 12, background: '#333', margin: '0 2px' }} />
        <button
          className="be-btn"
          style={{ fontSize: 9, padding: '2px 6px' }}
          onClick={() => setAllClipAudioMuted(!allClipAudioMuted)}
          title="전체 영상 클립 오디오 켜기/끄기"
          disabled={clips.length === 0}
        >
          {allClipAudioMuted ? '전체 오디오 켜기' : '전체 오디오 끄기'}
        </button>
        <div style={{ flex: 1 }} />
        {selectedClipIndex >= 0 && (
          <button
            className="be-btn"
            style={{ fontSize: 9, padding: '2px 6px', color: '#ef4444', borderColor: '#ef444444' }}
            onClick={() => {
              const state = useEditorStore.getState();
              if (state.selectedClipIndices.length > 1) {
                state.removeClips(state.selectedClipIndices);
              } else {
                removeClip(selectedClipIndex);
              }
            }}
          >
            클립 삭제
          </button>
        )}
        {selectedSubIndex >= 0 && (
          <button
            className="be-btn"
            style={{ fontSize: 9, padding: '2px 6px', color: '#ef4444', borderColor: '#ef444444' }}
            onClick={() => removeSubtitle(selectedSubIndex)}
          >
            자막 삭제
          </button>
        )}
      </div>

      {/* Time ruler */}
      <div style={{ display: 'flex', height: 20, borderBottom: '1px solid #222', flexShrink: 0 }}>
        <div style={{ width: HEADER_W, flexShrink: 0, borderRight: '1px solid #222' }} />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: timelineWidth, position: 'relative', height: '100%' }}>
            {(() => {
              const intervals = [0.5, 1, 2, 5, 10, 15, 30, 60];
              let interval = 1;
              for (const iv of intervals) {
                if (iv * pxPerSec >= 40) { interval = iv; break; }
              }
              const ticks = [];
              for (let t = 0; t <= totalDuration + interval; t += interval) {
                ticks.push(
                  <React.Fragment key={t}>
                    <div style={{
                      position: 'absolute',
                      left: t * pxPerSec,
                      top: 14,
                      width: 1,
                      height: 6,
                      background: '#333',
                    }} />
                    <span style={{
                      position: 'absolute',
                      left: t * pxPerSec + 2,
                      top: 2,
                      fontSize: 9,
                      color: '#555',
                      userSelect: 'none',
                    }}>
                      {t < 60 ? `${t}s` : `${Math.floor(t/60)}:${String(Math.round(t%60)).padStart(2,'0')}`}
                    </span>
                  </React.Fragment>
                );
              }
              return ticks;
            })()}
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div ref={scrollContainerRef} style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
        {/* Track labels */}
        <div style={{ width: HEADER_W, flexShrink: 0, borderRight: '1px solid #222' }}>
          {Array.from({ length: NUM_VIDEO_TRACKS }, (_, ti) => {
            const trackNum = NUM_VIDEO_TRACKS - ti;
            return (
              <div key={`vtrack-${trackNum}`} style={{ height: TRACK_HEIGHT, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 9, color: '#888', borderBottom: '1px solid #1a1a1a' }}>
                트랙 {trackNum}
              </div>
            );
          })}
          {[
            { label: '오디오', enabled: true, height: CLIP_AUDIO_TRACK_HEIGHT },
            { label: '자막', enabled: subsEnabled, height: subtitleTrackHeight },
            { label: 'BGM', enabled: bgmEnabled, height: TRACK_HEIGHT },
          ].map((track) => (
            <div key={track.label} style={{ height: track.height, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 9, color: track.enabled ? '#888' : '#444', borderBottom: '1px solid #1a1a1a' }}>
              {track.label}{!track.enabled && ' '}
            </div>
          ))}
        </div>

        {/* Track content */}
        <div
          ref={trackRef}
          style={{ flex: 1, position: 'relative', minWidth: timelineWidth }}
          onClick={handleTimelineClick}
        >
          {/* Clip tracks (multi-track) */}
          <div style={{ height: TRACK_HEIGHT * NUM_VIDEO_TRACKS, position: 'relative' }}>
            {Array.from({ length: NUM_VIDEO_TRACKS }, (_, ti) => (
              <div key={`track-line-${ti}`} style={{ position: 'absolute', top: ti * TRACK_HEIGHT + TRACK_HEIGHT - 1, left: 0, right: 0, height: 1, background: '#1a1a1a' }} />
            ))}
            {clips.map((clip, i) => {
              const left = (clip.timelineStart ?? clipStarts[i]) * pxPerSec;
              const width = clipDurations[i] * pxPerSec;
              const isSelected = selectedClipIndices.includes(i);
              const isPrimary = selectedClipIndex === i;
              const color = colors[i % colors.length];
              const track = clip.track ?? 0;
              const topPos = (NUM_VIDEO_TRACKS - 1 - track) * TRACK_HEIGHT + 3;

              return (
                <div
                  key={`clip-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.metaKey || e.ctrlKey) {
                      toggleClipSelection(i);
                    } else if (e.shiftKey && selectedClipIndex >= 0) {
                      selectClipRange(selectedClipIndex, i);
                    } else {
                      setSelectedClipIndex(i);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = (trackRef.current || e.currentTarget.parentElement)!.getBoundingClientRect();
                    const clickTime = (e.clientX - rect.left) / pxPerSec;
                    const clipTimelineStart = clip.timelineStart ?? clipStarts[i];
                    const clipLocalTime = clickTime - clipTimelineStart;
                    const speed = clipMeta[i]?.speed ?? 1;
                    const splitAt = clip.start + clipLocalTime * speed;
                    if (splitAt > clip.start + 0.1 && splitAt < clip.end - 0.1) {
                      setCtxMenu({ x: e.clientX, y: e.clientY, clipIdx: i, splitTime: splitAt });
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                    if (!selectedClipIndices.includes(i)) {
                      setSelectedClipIndex(i);
                    }
                    const mouseTime = getTimeFromX(e.clientX);
                    dragOffsetSec.current = mouseTime - (clip.timelineStart ?? clipStarts[i]);
                    startDrag('clip-move', i, e, { start: clip.start, end: clip.end });
                  }}
                  style={{
                    position: 'absolute',
                    left,
                    top: topPos,
                    width: Math.max(width, 8),
                    height: TRACK_HEIGHT - 6,
                    background: isSelected ? color : `${color}88`,
                    border: isSelected
                      ? isPrimary
                        ? `2px solid ${color}`
                        : `1.5px solid ${color}`
                      : '1px solid transparent',
                    borderRadius: 3,
                    cursor: dragMode === 'clip-move' && dragIndex === i ? 'grabbing' : 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: TRIM_HANDLE_W + 2,
                    paddingRight: TRIM_HANDLE_W + 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={trimHandleStyle('left')}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedClipIndex(i);
                      startDrag('clip-trim-left', i, e, { start: clip.start, end: clip.end, audioStart: clip.timelineStart ?? clipStarts[i] });
                    }}
                  />
                  <span style={{ fontSize: 8, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {clip.source.replace(/\.[^.]+$/, '')}
                  </span>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', marginLeft: 2 }}>
                    {clipDurations[i].toFixed(1)}s
                  </span>
                  <div
                    style={trimHandleStyle('right')}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedClipIndex(i);
                      startDrag('clip-trim-right', i, e, { start: clip.start, end: clip.end });
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Clip audio track */}
          <div style={{ height: CLIP_AUDIO_TRACK_HEIGHT, position: 'relative', borderBottom: '1px solid #1a1a1a' }}>
            {clips.map((clip, i) => {
              const left = (clip.timelineStart ?? clipStarts[i]) * pxPerSec;
              const width = clipDurations[i] * pxPerSec;
              const audioInfo = clipAudioInfo[clip.source];
              const hasAudio = audioInfo?.hasAudio !== false;
              const isMuted = clipMeta[i]?.audioMuted ?? false;
              const isSelected = selectedClipIndex === i;

              if (!hasAudio) {
                return (
                  <div
                    key={`clip-audio-empty-${i}`}
                    style={{
                      position: 'absolute',
                      left,
                      top: 4,
                      width: Math.max(width, 8),
                      height: CLIP_AUDIO_TRACK_HEIGHT - 8,
                      border: '1px dashed #2f2f2f',
                      borderRadius: 3,
                      color: '#555',
                      fontSize: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#131313',
                    }}
                  >
                    오디오 없음
                  </div>
                );
              }

              return (
                <div
                  key={`clip-audio-${i}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedClipIndex(i);
                    setActivePanel('clip');
                  }}
                  style={{
                    position: 'absolute',
                    left,
                    top: 4,
                    width: Math.max(width, 8),
                    height: CLIP_AUDIO_TRACK_HEIGHT - 8,
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: isSelected ? `1px solid ${isMuted ? '#ef4444' : '#60a5fa'}` : '1px solid rgba(255,255,255,0.08)',
                    background: isMuted ? 'rgba(127,29,29,0.28)' : 'rgba(30,41,59,0.9)',
                    cursor: 'pointer',
                  }}
                >
                  <canvas
                    ref={(el) => drawClipWaveform(el, clip.source, Math.max(width, 8), isMuted)}
                    width={Math.max(width, 8)}
                    height={CLIP_AUDIO_TRACK_HEIGHT - 8}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />
                  <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '0 6px' }}>
                    <span style={{ fontSize: 8, color: isMuted ? '#fca5a5' : '#bfdbfe', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isMuted ? '🔇 클립 오디오 꺼짐' : '🔊 클립 오디오'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipIndex(i);
                        setActivePanel('clip');
                        updateClipMeta(i, { audioMuted: !isMuted });
                      }}
                      style={{
                        border: 'none',
                        background: isMuted ? '#7f1d1d' : '#1d4ed8',
                        color: '#fff',
                        borderRadius: 3,
                        padding: '1px 5px',
                        fontSize: 8,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {isMuted ? '켜기' : '끄기'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtitle track */}
          <div style={{ height: subtitleTrackHeight, position: 'relative', borderBottom: '1px solid #1a1a1a', opacity: subsEnabled ? 1 : 0.3 }}>
            {globalSubs.map((sub, i) => {
              const left = sub.start * pxPerSec;
              const width = (sub.end - sub.start) * pxPerSec;
              const isSelected = selectedSubIndex === i;
              const lane = subtitleLanes[i];

              return (
                <div
                  key={`sub-${i}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedSubIndex(i); }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    setSelectedSubIndex(i);
                    startDrag('sub-move', i, e, { start: sub.start, end: sub.end });
                  }}
                  style={{
                    position: 'absolute',
                    left,
                    top: 2 + lane * subtitleLaneHeight,
                    width: Math.max(width, 8),
                    height: subtitleLaneHeight - 2,
                    background: isSelected ? '#f59e0b' : '#f59e0b55',
                    border: isSelected ? '1px solid #f59e0b' : '1px solid transparent',
                    borderRadius: 3,
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: TRIM_HANDLE_W + 2,
                    paddingRight: TRIM_HANDLE_W + 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={trimHandleStyle('left')}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedSubIndex(i);
                      startDrag('sub-trim-left', i, e, { start: sub.start, end: sub.end });
                    }}
                  />
                  <span style={{ fontSize: 8, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                    {sub.text}
                  </span>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', marginLeft: 2 }}>
                    {(sub.end - sub.start).toFixed(1)}s
                  </span>
                  <div
                    style={trimHandleStyle('right')}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedSubIndex(i);
                      startDrag('sub-trim-right', i, e, { start: sub.start, end: sub.end });
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* BGM track */}
          <div style={{ height: TRACK_HEIGHT, position: 'relative', borderBottom: '1px solid #1a1a1a', opacity: bgmEnabled ? 1 : 0.3 }}>
            {bgmClips.map((bgm, i) => {
              const left = bgm.start * pxPerSec;
              const width = bgm.duration * pxPerSec;

              return (
                <div
                  key={`bgm-${i}`}
                  onClick={(e) => { e.stopPropagation(); setActivePanel('bgm'); setSelectedBgmIndex(i); }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    setActivePanel('bgm');
                    setSelectedBgmIndex(i);
                    startDrag('bgm-move', i, e, { start: bgm.start, end: bgm.duration });
                  }}
                  style={{
                    position: 'absolute',
                    left,
                    top: 3,
                    width: Math.max(width, 8),
                    height: TRACK_HEIGHT - 6,
                    background: '#10b98155',
                    border: '1px solid #10b981',
                    borderRadius: 3,
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: TRIM_HANDLE_W + 2,
                    paddingRight: TRIM_HANDLE_W + 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={trimHandleStyle('left')}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startDrag('bgm-trim-left', i, e, { start: bgm.start, end: bgm.duration, audioStart: bgm.audioStart });
                    }}
                  />
                  <canvas
                    key={`bgm-canvas-${i}-${waveformVersion}-${bgm.audioStart}-${bgm.duration}`}
                    ref={(el) => drawBgmWaveform(el, bgm.source, Math.max(width, 8), bgm.audioStart, bgm.duration, bgm.totalDuration)}
                    width={Math.max(width, 8)}
                    height={TRACK_HEIGHT - 6}
                    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  />
                  <span style={{ fontSize: 8, color: '#a7f3d0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, zIndex: 1 }}>
                    {bgm.source}
                  </span>
                  <span style={{ fontSize: 7, color: 'rgba(167,243,208,0.7)', whiteSpace: 'nowrap', marginLeft: 2, zIndex: 1 }}>
                    {bgm.duration.toFixed(1)}s
                  </span>
                  <div
                    style={trimHandleStyle('right')}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startDrag('bgm-trim-right', i, e, { start: bgm.start, end: bgm.duration });
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Context menu for clip split */}
          {ctxMenu && (
            <div
              style={{
                position: 'fixed',
                left: ctxMenu.x,
                top: ctxMenu.y,
                background: '#222',
                border: '1px solid #444',
                borderRadius: 4,
                padding: 2,
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: '#ddd',
                  padding: '6px 12px',
                  fontSize: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                onClick={() => {
                  splitClip(ctxMenu.clipIdx, ctxMenu.splitTime);
                  setCtxMenu(null);
                }}
              >
                ✂️ 여기서 분할 ({ctxMenu.splitTime.toFixed(1)}s)
              </button>
            </div>
          )}

          {/* Snap indicator line */}
          {snapLineX !== null && (
            <div
              style={{
                position: 'absolute',
                left: snapLineX,
                top: 0,
                bottom: 0,
                width: 1,
                background: '#facc15',
                zIndex: 9,
                pointerEvents: 'none',
                boxShadow: '0 0 4px #facc15',
              }}
            />
          )}

          {/* Playhead */}
          <div
            style={{
              position: 'absolute',
              left: currentTime * pxPerSec,
              top: 0,
              bottom: 0,
              width: 1,
              background: '#ef4444',
              zIndex: 10,
              cursor: 'ew-resize',
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag('playhead', 0, e, { start: currentTime, end: 0 });
            }}
          >
            <div style={{
              position: 'absolute',
              top: -2,
              left: -5,
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '8px solid #ef4444',
              cursor: 'ew-resize',
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};
