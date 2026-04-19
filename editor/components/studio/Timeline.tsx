'use client';

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { getEditorConfig } from '@/editor.config';
import { useEditorStore } from './store';
import type { Clip } from './types';
import { NUM_VIDEO_TRACKS } from './types';

const API_URL = typeof window !== 'undefined' ? getEditorConfig().apiUrl : 'http://localhost:8092';

const FPS = 30;
const TRACK_HEIGHT = 48;
const CLIP_AUDIO_TRACK_HEIGHT = 32;
const HEADER_W = 60;
const TRIM_HANDLE_W = 6;
const MIN_CLIP_DURATION = 0.1;
const SNAP_THRESHOLD_PX = 8;

type ClipAudioInfo = {
  hasAudio: boolean;
};

type DragMode = null | 'playhead' | 'clip-move' | 'clip-trim-left' | 'clip-trim-right' | 'sub-move' | 'sub-trim-left' | 'sub-trim-right' | 'bgm-move' | 'bgm-trim-left' | 'bgm-trim-right';

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
  const moveClips = useEditorStore((s) => s.moveClips);
  const setSelectedSubIndex = useEditorStore((s) => s.setSelectedSubIndex);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const setPxPerSec = useEditorStore((s) => s.setPxPerSec);
  const subsEnabled = useEditorStore((s) => s.subsEnabled);
  const bgmEnabled = useEditorStore((s) => s.bgmEnabled);
  const removeClip = useEditorStore((s) => s.removeClip);
  const removeSubtitle = useEditorStore((s) => s.removeSubtitle);
  const updateClip = useEditorStore((s) => s.updateClip);
  const updateClipMeta = useEditorStore((s) => s.updateClipMeta);
  const setAllClipAudioMuted = useEditorStore((s) => s.setAllClipAudioMuted);
  const updateGlobalSub = useEditorStore((s) => s.updateGlobalSub);
  const updateBgmClip = useEditorStore((s) => s.updateBgmClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const splitClip = useEditorStore((s) => s.splitClip);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const copySubtitle = useEditorStore((s) => s.copySubtitle);
  const copyClip = useEditorStore((s) => s.copyClip);
  const paste = useEditorStore((s) => s.paste);
  const addClip = useEditorStore((s) => s.addClip);
  const moveClipToTrackAndTime = useEditorStore((s) => s.moveClipToTrackAndTime);

  const [fileDragOver, setFileDragOver] = useState(false);
  const handleFileDrop = useCallback(async (files: FileList) => {
    const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!videoExts.includes(ext)) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        // Next.js rewrite 프록시 먼저 시도, 실패 시 직접 요청
        let uploadOk = false;
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: formData });
          uploadOk = res.ok;
        } catch {}
        if (!uploadOk) {
          const formData2 = new FormData();
          formData2.append('file', file);
          const res2 = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData2 });
          uploadOk = res2.ok;
        }
        if (!uploadOk) {
          console.error('[드래그앤드롭] 업로드 실패');
          continue;
        }
        let duration = 10;
        for (let retry = 0; retry < 3; retry++) {
          try {
            const pr = await fetch(`/api/media/probe/${encodeURIComponent(file.name)}`);
            if (pr.ok) {
              const pd = await pr.json();
              if (pd.duration && pd.duration > 0) { duration = pd.duration; break; }
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 500));
        }
        addClip({ source: file.name, start: 0, end: duration, source_idx: 0 } as Clip);
      } catch (e) {
        console.error('[타임라인 드래그앤드롭] 영상 추가 실패:', e);
      }
    }
  }, [addClip]);

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragIndex, setDragIndex] = useState(-1);
  const dragStartX = useRef(0);
  const dragStartVal = useRef<{ start: number; end: number; audioStart?: number }>({ start: 0, end: 0 });
  const dragOffsetSec = useRef(0); // clip-move: 드래그 시작 시 마우스와 클립 왼쪽 간 오프셋(초)

  // Snap indicator line
  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const [selectedBgmIndex, setSelectedBgmIndex] = useState(-1);

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

  // Snap points: ALL element boundaries + playhead (Feature 3)
  const snapPoints: number[] = [];
  clips.forEach((c, i) => {
    const cs = c.timelineStart ?? clipStarts[i];
    snapPoints.push(cs);
    snapPoints.push(cs + clipDurations[i]);
  });
  globalSubs.forEach((sub) => {
    snapPoints.push(sub.start);
    snapPoints.push(sub.end);
  });
  bgmClips.forEach((b) => {
    snapPoints.push(b.start);
    snapPoints.push(b.start + b.duration);
  });
  // Also snap to playhead
  snapPoints.push(currentTime);

  const snapToNearest = (time: number, excludePoints?: number[]): { time: number; snapped: boolean } => {
    const threshold = SNAP_THRESHOLD_PX / pxPerSec;
    let best = time;
    let bestDist = threshold;
    let snapped = false;
    for (const sp of snapPoints) {
      if (excludePoints && excludePoints.some((ep) => Math.abs(ep - sp) < 0.001)) continue;
      const dist = Math.abs(time - sp);
      if (dist < bestDist) {
        bestDist = dist;
        best = sp;
        snapped = true;
      }
    }
    return { time: best, snapped };
  };

  // Seek
  const seekToTime = useCallback((time: number) => {
    const frame = Math.max(0, Math.round(time * FPS));
    const seekTo = (window as unknown as Record<string, (f: number) => void>).__studioSeekTo;
    if (seekTo) seekTo(frame);
  }, []);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode) return;
    const rect = (trackRef.current || e.currentTarget).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 0) return;
    seekToTime(x / pxPerSec);
  }, [pxPerSec, seekToTime, dragMode]);

  // Drag handlers
  const getTimeFromX = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / pxPerSec);
  }, [pxPerSec]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragMode) return;
    const deltaX = e.clientX - dragStartX.current;
    const deltaSec = deltaX / pxPerSec;

    if (dragMode === 'playhead') {
      seekToTime(getTimeFromX(e.clientX));
      setSnapLineX(null);
    } else if (dragMode === 'clip-trim-left') {
      const speed = clipMeta[dragIndex]?.speed ?? 1;
      const rawStart = Math.max(0, dragStartVal.current.start + deltaSec * speed);
      if (rawStart < dragStartVal.current.end - MIN_CLIP_DURATION) {
        // 타임라인 끝 위치 고정: timelineStart를 조절해서 끝 위치 유지
        const origTimelineStart = dragStartVal.current.audioStart ?? (clips[dragIndex].timelineStart ?? clipStarts[dragIndex]);
        const origTimelineEnd = origTimelineStart + (dragStartVal.current.end - dragStartVal.current.start) / speed;
        const sourceDelta = rawStart - dragStartVal.current.start;
        const newTimelineStart = origTimelineStart + sourceDelta / speed;
        // Snap the timeline edge of the clip's left side
        const snap = snapToNearest(newTimelineStart, [origTimelineStart]);
        if (snap.snapped) {
          const snappedSourceDelta = (snap.time - origTimelineStart) * speed;
          const snappedStart = dragStartVal.current.start + snappedSourceDelta;
          if (snappedStart >= 0 && snappedStart < dragStartVal.current.end - MIN_CLIP_DURATION) {
            updateClip(dragIndex, { start: snappedStart, timelineStart: snap.time });
            setSnapLineX(snap.time * pxPerSec);
          }
        } else {
          updateClip(dragIndex, { start: rawStart, timelineStart: Math.max(0, newTimelineStart) });
          setSnapLineX(null);
        }
      }
    } else if (dragMode === 'clip-trim-right') {
      const speed = clipMeta[dragIndex]?.speed ?? 1;
      let newEnd = Math.max(dragStartVal.current.start + MIN_CLIP_DURATION, dragStartVal.current.end + deltaSec * speed);
      // Snap the timeline edge of the clip's right side
      const clipTlStart = clips[dragIndex].timelineStart ?? clipStarts[dragIndex];
      const newTimelineEnd = clipTlStart + (newEnd - clips[dragIndex].start) / speed;
      const origTimelineEnd = clipTlStart + clipDurations[dragIndex];
      const snap = snapToNearest(newTimelineEnd, [origTimelineEnd]);
      if (snap.snapped) {
        newEnd = clips[dragIndex].start + (snap.time - clipTlStart) * speed;
        newEnd = Math.max(dragStartVal.current.start + MIN_CLIP_DURATION, newEnd);
        updateClip(dragIndex, { end: newEnd });
        setSnapLineX(snap.time * pxPerSec);
      } else {
        updateClip(dragIndex, { end: newEnd });
        setSnapLineX(null);
      }
    } else if (dragMode === 'clip-move') {
      // 절대 위치 이동: 수평(timelineStart) + 수직(track)
      const rawTime = getTimeFromX(e.clientX) - dragOffsetSec.current;
      const newTimelineStart = Math.max(0, rawTime);

      // 수직 → track 결정
      if (!trackRef.current) return;
      const trackRect = trackRef.current.getBoundingClientRect();
      const relY = e.clientY - trackRect.top;
      // 트랙 레이아웃: 트랙2(상단)→트랙1→트랙0(하단), 각 TRACK_HEIGHT 높이
      let newTrack = Math.floor(relY / TRACK_HEIGHT);
      newTrack = NUM_VIDEO_TRACKS - 1 - newTrack; // 반전: 상단=트랙2, 하단=트랙0
      newTrack = Math.max(0, Math.min(NUM_VIDEO_TRACKS - 1, newTrack));

      // 스냅
      const excludePoints = [clips[dragIndex].timelineStart ?? 0, (clips[dragIndex].timelineStart ?? 0) + clipDurations[dragIndex]];
      const snappedStart = snapToNearest(newTimelineStart, excludePoints);
      const snappedEnd = snapToNearest(newTimelineStart + clipDurations[dragIndex], excludePoints);

      let finalStart = newTimelineStart;
      if (snappedStart.snapped && (!snappedEnd.snapped || Math.abs(snappedStart.time - newTimelineStart) <= Math.abs(snappedEnd.time - (newTimelineStart + clipDurations[dragIndex])))) {
        finalStart = snappedStart.time;
        setSnapLineX(snappedStart.time * pxPerSec);
      } else if (snappedEnd.snapped) {
        finalStart = snappedEnd.time - clipDurations[dragIndex];
        setSnapLineX(snappedEnd.time * pxPerSec);
      } else {
        setSnapLineX(null);
      }
      finalStart = Math.max(0, finalStart);

      moveClipToTrackAndTime(dragIndex, newTrack, finalStart);
    } else if (dragMode === 'sub-move') {
      const sub = globalSubs[dragIndex];
      if (!sub) return;
      const dur = dragStartVal.current.end - dragStartVal.current.start;
      let newStart = Math.max(0, dragStartVal.current.start + deltaSec);
      // Snap start and end
      const excludes = [dragStartVal.current.start, dragStartVal.current.end];
      const snappedStart = snapToNearest(newStart, excludes);
      const snappedEnd = snapToNearest(newStart + dur, excludes);
      if (snappedStart.snapped && (!snappedEnd.snapped || Math.abs(snappedStart.time - newStart) <= Math.abs(snappedEnd.time - (newStart + dur)))) {
        newStart = snappedStart.time;
        setSnapLineX(snappedStart.time * pxPerSec);
      } else if (snappedEnd.snapped) {
        newStart = snappedEnd.time - dur;
        setSnapLineX(snappedEnd.time * pxPerSec);
      } else {
        setSnapLineX(null);
      }
      updateGlobalSub(dragIndex, { start: newStart, end: newStart + dur });
    } else if (dragMode === 'sub-trim-left') {
      let newStart = Math.max(0, dragStartVal.current.start + deltaSec);
      const excludes = [dragStartVal.current.start];
      const snap = snapToNearest(newStart, excludes);
      if (snap.snapped) {
        newStart = snap.time;
        setSnapLineX(snap.time * pxPerSec);
      } else {
        setSnapLineX(null);
      }
      if (newStart < dragStartVal.current.end - MIN_CLIP_DURATION) {
        updateGlobalSub(dragIndex, { start: newStart });
      }
    } else if (dragMode === 'sub-trim-right') {
      let newEnd = Math.max(dragStartVal.current.start + MIN_CLIP_DURATION, dragStartVal.current.end + deltaSec);
      const excludes = [dragStartVal.current.end];
      const snap = snapToNearest(newEnd, excludes);
      if (snap.snapped) {
        newEnd = snap.time;
        setSnapLineX(snap.time * pxPerSec);
      } else {
        setSnapLineX(null);
      }
      updateGlobalSub(dragIndex, { end: newEnd });
    } else if (dragMode === 'bgm-move') {
      const bgm = bgmClips[dragIndex];
      if (!bgm) return;
      let newStart = Math.max(0, dragStartVal.current.start + deltaSec);
      const dur = bgm.duration;
      const excludes = [dragStartVal.current.start, dragStartVal.current.start + dur];
      const snappedStart = snapToNearest(newStart, excludes);
      const snappedEnd = snapToNearest(newStart + dur, excludes);
      if (snappedStart.snapped && (!snappedEnd.snapped || Math.abs(snappedStart.time - newStart) <= Math.abs(snappedEnd.time - (newStart + dur)))) {
        newStart = snappedStart.time;
        setSnapLineX(snappedStart.time * pxPerSec);
      } else if (snappedEnd.snapped) {
        newStart = snappedEnd.time - dur;
        setSnapLineX(snappedEnd.time * pxPerSec);
      } else {
        setSnapLineX(null);
      }
      newStart = Math.max(0, newStart);
      updateBgmClip(dragIndex, { start: newStart });
    } else if (dragMode === 'bgm-trim-left') {
      const bgm = bgmClips[dragIndex];
      if (!bgm) return;
      let newStart = Math.max(0, dragStartVal.current.start + deltaSec);
      const snap = snapToNearest(newStart, [dragStartVal.current.start]);
      if (snap.snapped) {
        newStart = snap.time;
        setSnapLineX(snap.time * pxPerSec);
      } else {
        setSnapLineX(null);
      }
      const delta = newStart - dragStartVal.current.start;
      const origAudioStart = dragStartVal.current.audioStart ?? 0;
      let newAudioStart = Math.max(0, origAudioStart + delta);
      const newDuration = Math.max(MIN_CLIP_DURATION, dragStartVal.current.end - delta);
      // 오리지널 길이를 초과하지 않도록 제한
      const origDur = bgm.totalDuration || bgmWaveformDurations.current.get(bgm.source) || 0;
      const maxDuration = origDur > 0 ? origDur - newAudioStart : Infinity;
      updateBgmClip(dragIndex, { start: newStart, audioStart: newAudioStart, duration: Math.min(newDuration, maxDuration) });
    } else if (dragMode === 'bgm-trim-right') {
      let newDuration = Math.max(MIN_CLIP_DURATION, dragStartVal.current.end + deltaSec);
      const bgm = bgmClips[dragIndex];
      if (bgm) {
        // 오리지널 길이를 초과하지 않도록 제한
        const origDur = bgm.totalDuration || bgmWaveformDurations.current.get(bgm.source) || 0;
        const maxDuration = origDur > 0 ? origDur - (bgm.audioStart || 0) : Infinity;
        newDuration = Math.min(newDuration, maxDuration);
        const newEnd = bgm.start + newDuration;
        const snap = snapToNearest(newEnd, [bgm.start + dragStartVal.current.end]);
        if (snap.snapped) {
          newDuration = Math.max(MIN_CLIP_DURATION, snap.time - bgm.start);
          newDuration = Math.min(newDuration, maxDuration);
          setSnapLineX(snap.time * pxPerSec);
        } else {
          setSnapLineX(null);
        }
      }
      updateBgmClip(dragIndex, { duration: newDuration });
    }
  }, [dragMode, dragIndex, pxPerSec, clipMeta, clipStarts, clipDurations, clips, globalSubs, bgmClips, getTimeFromX, seekToTime, updateClip, moveClip, moveClips, moveClipToTrackAndTime, selectedClipIndices, updateGlobalSub, updateBgmClip, snapToNearest]);

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
    setDragIndex(-1);
    setSnapLineX(null);
  }, []);

  useEffect(() => {
    if (dragMode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragMode, handleMouseMove, handleMouseUp]);

  // Keyboard: Delete, Undo/Redo, Copy/Paste, Fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || (active as HTMLElement).isContentEditable);

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        const state = useEditorStore.getState();
        if (state.activePanel === 'clip' && state.selectedClipIndices.length > 1) {
          e.preventDefault();
          state.removeClips(state.selectedClipIndices);
        } else if (selectedClipIndex >= 0 && state.activePanel === 'clip') {
          e.preventDefault();
          removeClip(selectedClipIndex);
        } else if (selectedSubIndex >= 0 && state.activePanel === 'subtitle') {
          e.preventDefault();
          removeSubtitle(selectedSubIndex);
        } else if (selectedBgmIndex >= 0 && state.activePanel === 'bgm') {
          e.preventDefault();
          state.removeBgmClip(selectedBgmIndex);
          setSelectedBgmIndex(-1);
        }
      }

      // Undo: Cmd+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        undo();
      }

      // Redo: Cmd+Shift+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        redo();
      }

      // Copy: Cmd+C
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        if (isInput) return;
        const state = useEditorStore.getState();
        if (state.activePanel === 'subtitle' && state.selectedSubIndex >= 0) {
          e.preventDefault();
          copySubtitle();
        } else if (state.activePanel === 'clip' && state.selectedClipIndex >= 0) {
          e.preventDefault();
          copyClip();
        }
      }

      // Paste: Cmd+V
      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        if (isInput) return;
        e.preventDefault();
        paste();
      }

      // Fullscreen: F
      if (e.key === 'f' || e.key === 'F') {
        if (isInput) return;
        // Dispatch custom event for fullscreen toggle
        window.dispatchEvent(new CustomEvent('studio-fullscreen-toggle'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedClipIndex, selectedSubIndex, removeClip, removeSubtitle, undo, redo, copySubtitle, copyClip, paste]);

  // Feature 4: Playhead auto-follow during playback
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

  const startDrag = (mode: DragMode, index: number, e: React.MouseEvent, startVal: { start: number; end: number; audioStart?: number }) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode(mode);
    setDragIndex(index);
    dragStartX.current = e.clientX;
    dragStartVal.current = startVal;
  };

  // BGM waveform cache
  const bgmWaveforms = useRef<Map<string, Float32Array>>(new Map());
  const bgmWaveformDurations = useRef<Map<string, number>>(new Map());
  const clipWaveforms = useRef<Map<string, Float32Array>>(new Map());
  const [clipAudioInfo, setClipAudioInfo] = useState<Record<string, ClipAudioInfo>>({});
  const [waveformVersion, setWaveformVersion] = useState(0);

  const buildMediaUrl = useCallback((source: string) => {
    // 오디오 파일은 프록시 디렉토리에 없으므로 직접 경로 사용
    const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(source);
    if (isAudio) {
      return `${getEditorConfig().apiUrl}/${encodeURIComponent(source)}`;
    }
    const prefix = getEditorConfig().mediaProxyPrefix || '/_proxy';
    return `${getEditorConfig().apiUrl}${prefix}/${encodeURIComponent(source)}`;
  }, []);

  const extractWaveform = useCallback(async (source: string) => {
    const url = buildMediaUrl(source);
    console.log('[Waveform] Fetching:', url);
    try {
      const response = await fetch(url);
      if (!response.ok) { console.warn('[Waveform] Fetch failed:', response.status); return null; }
      const buf = await response.arrayBuffer();
      console.log('[Waveform] ArrayBuffer size:', buf.byteLength);
      const audioCtx = new AudioContext();
      try {
        const decoded = await audioCtx.decodeAudioData(buf);
        const data = decoded.getChannelData(0);
        console.log('[Waveform] Decoded samples:', data.length, 'sampleRate:', decoded.sampleRate);
        // Very high resolution: store min/max pairs per window for detailed waveform
        const targetLen = Math.min(16000, data.length);
        const windowSize = Math.max(1, Math.floor(data.length / targetLen));
        const result = new Float32Array(targetLen);
        for (let i = 0; i < targetLen; i++) {
          const start = i * windowSize;
          const end = Math.min(start + windowSize, data.length);
          let peak = 0;
          for (let j = start; j < end; j++) {
            const abs = Math.abs(data[j]);
            if (abs > peak) peak = abs;
          }
          result[i] = peak;
        }
        const audioDuration = decoded.duration;
        console.log('[Waveform] Generated', result.length, 'peaks, duration:', audioDuration);
        return { peaks: result, duration: audioDuration };
      } finally {
        void audioCtx.close();
      }
    } catch (err) {
      console.error('[Waveform] Error:', err);
      return null;
    }
  }, [buildMediaUrl]);

  const drawWaveformBars = useCallback((ctx: CanvasRenderingContext2D, widthPx: number, h: number, waveData: Float32Array | undefined, color: string, fallbackColor: string) => {
    if (!waveData || waveData.length === 0) {
      ctx.strokeStyle = fallbackColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < widthPx; x += 3) {
        const y = h / 2 + Math.sin(x * 0.15) * (h * 0.22);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    // Draw detailed mirrored waveform with gradient intensity
    const mid = h / 2;
    // Parse base color for gradient
    const baseAlpha = 0.7;
    for (let x = 0; x < widthPx; x++) {
      const sampleIdx = Math.floor(x * waveData.length / widthPx);
      const sampleEnd = Math.min(Math.floor((x + 1) * waveData.length / widthPx), waveData.length);
      let peak = 0;
      let rms = 0;
      let count = 0;
      for (let j = sampleIdx; j < sampleEnd; j++) {
        const v = Math.abs(waveData[j]);
        if (v > peak) peak = v;
        rms += v * v;
        count++;
      }
      rms = count > 0 ? Math.sqrt(rms / count) : 0;
      // Outer bar (peak) — lighter
      const peakH = Math.max(1, peak * (h - 2));
      ctx.fillStyle = color;
      ctx.fillRect(x, mid - peakH / 2, 1, peakH);
      // Inner bar (RMS) — brighter, shows average energy
      const rmsH = Math.max(1, rms * (h - 2));
      ctx.fillStyle = color.replace(/[\d.]+\)$/, `${baseAlpha})`);
      ctx.fillRect(x, mid - rmsH / 2, 1, rmsH);
    }
  }, []);

  const drawBgmWaveform = useCallback((canvas: HTMLCanvasElement | null, bgmSource: string, widthPx: number, audioStart?: number, duration?: number, totalDuration?: number) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const h = canvas.height;
    ctx.clearRect(0, 0, widthPx, h);
    let waveData = bgmWaveforms.current.get(bgmSource);
    // Slice waveform to show only the audible portion (audioStart ~ audioStart+duration)
    const audioDur = totalDuration || bgmWaveformDurations.current.get(bgmSource) || 0;
    if (waveData && waveData.length > 0 && audioDur > 0 && audioStart != null && duration != null && duration < audioDur - 0.01) {
      const startRatio = audioStart / audioDur;
      const endRatio = Math.min((audioStart + duration) / audioDur, 1);
      const startIdx = Math.floor(startRatio * waveData.length);
      const endIdx = Math.min(Math.ceil(endRatio * waveData.length), waveData.length);
      if (endIdx > startIdx) {
        waveData = waveData.slice(startIdx, endIdx);
      }
    }
    drawWaveformBars(ctx, widthPx, h, waveData, '#10b98166', '#10b98144');
  }, [drawWaveformBars]);

  const drawClipWaveform = useCallback((canvas: HTMLCanvasElement | null, clipSource: string, widthPx: number, muted: boolean) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const h = canvas.height;
    ctx.clearRect(0, 0, widthPx, h);
    drawWaveformBars(
      ctx,
      widthPx,
      h,
      clipWaveforms.current.get(clipSource),
      muted ? 'rgba(239,68,68,0.28)' : 'rgba(96,165,250,0.45)',
      muted ? 'rgba(239,68,68,0.22)' : 'rgba(96,165,250,0.22)',
    );
  }, [drawWaveformBars]);

  // Try loading waveform data for BGM clips
  useEffect(() => {
    for (const bgm of bgmClips) {
      if (bgmWaveforms.current.has(bgm.source)) continue;
      extractWaveform(bgm.source)
        .then((result) => {
          if (result) {
            bgmWaveforms.current.set(bgm.source, result.peaks);
            bgmWaveformDurations.current.set(bgm.source, result.duration);
            setWaveformVersion((v) => v + 1);
          }
        })
        .catch(() => { /* ignore */ });
    }
  }, [bgmClips, extractWaveform]);

  useEffect(() => {
    for (const clip of clips) {
      if (clipAudioInfo[clip.source]) continue;
      fetch(`/api/media/probe/${encodeURIComponent(clip.source)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((info) => {
          if (!info) return;
          setClipAudioInfo((prev) => prev[clip.source] ? prev : { ...prev, [clip.source]: { hasAudio: info.hasAudio !== false } });
          if (info.hasAudio === false || clipWaveforms.current.has(clip.source)) return;
          return extractWaveform(clip.source).then((result) => {
            if (result) clipWaveforms.current.set(clip.source, result.peaks);
          });
        })
        .catch(() => {
          setClipAudioInfo((prev) => prev[clip.source] ? prev : { ...prev, [clip.source]: { hasAudio: true } });
        });
    }
  }, [clips, clipAudioInfo, extractWaveform]);

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
        {/* Undo/Redo buttons */}
        <button
          className="btn"
          style={{ fontSize: 9, padding: '2px 6px', opacity: canUndo() ? 1 : 0.3 }}
          onClick={() => undo()}
          disabled={!canUndo()}
          title="실행 취소 (Cmd+Z)"
        >↩</button>
        <button
          className="btn"
          style={{ fontSize: 9, padding: '2px 6px', opacity: canRedo() ? 1 : 0.3 }}
          onClick={() => redo()}
          disabled={!canRedo()}
          title="다시 실행 (Cmd+Shift+Z)"
        >↪</button>
        <div style={{ width: 1, height: 12, background: '#333', margin: '0 2px' }} />
        <button className="btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => setPxPerSec(pxPerSec - 20)}>-</button>
        <span style={{ fontSize: 9, color: '#555', minWidth: 32, textAlign: 'center' }}>{pxPerSec}px/s</span>
        <button className="btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => setPxPerSec(pxPerSec + 20)}>+</button>
        <button
          className="btn"
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
          className="btn"
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
          className="btn"
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
            className="btn"
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
            className="btn"
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
          {/* Video tracks: 트랙3(상단) → 트랙2 → 트랙1(하단) */}
          {Array.from({ length: NUM_VIDEO_TRACKS }, (_, ti) => {
            const trackNum = NUM_VIDEO_TRACKS - ti; // 3, 2, 1
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
          {/* Clip tracks (multi-track: 트랙2=상단, 트랙0=하단) */}
          <div style={{ height: TRACK_HEIGHT * NUM_VIDEO_TRACKS, position: 'relative' }}>
            {/* 트랙 구분선 */}
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
                    // dragOffsetSec: 마우스와 클립 왼쪽 간 오프셋
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

          {/* Subtitle track — auto lane assignment for overlapping subs */}
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

          {/* Snap indicator line (Feature 3) */}
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
