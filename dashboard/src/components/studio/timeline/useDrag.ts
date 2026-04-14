import { useRef, useCallback, useState, useEffect } from 'react';
import { useEditorStore } from '../store';
import { NUM_VIDEO_TRACKS } from '../types';
import { FPS, MIN_CLIP_DURATION, SNAP_THRESHOLD_PX, TRACK_HEIGHT } from './constants';
import type { DragMode } from './constants';

interface UseDragParams {
  clipStarts: number[];
  clipDurations: number[];
  trackRef: React.RefObject<HTMLDivElement | null>;
  bgmWaveformDurations: React.RefObject<Map<string, number>>;
}

export function useDrag({ clipStarts, clipDurations, trackRef, bgmWaveformDurations }: UseDragParams) {
  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const globalSubs = useEditorStore((s) => s.globalSubs);
  const bgmClips = useEditorStore((s) => s.bgmClips);
  const currentFrame = useEditorStore((s) => s.currentFrame);
  const selectedClipIndices = useEditorStore((s) => s.selectedClipIndices);
  const pxPerSec = useEditorStore((s) => s.pxPerSec);
  const updateClip = useEditorStore((s) => s.updateClip);
  const updateGlobalSub = useEditorStore((s) => s.updateGlobalSub);
  const updateBgmClip = useEditorStore((s) => s.updateBgmClip);
  const moveClipToTrackAndTime = useEditorStore((s) => s.moveClipToTrackAndTime);
  const moveClips = useEditorStore((s) => s.moveClips);
  const moveClip = useEditorStore((s) => s.moveClip);

  const currentTime = currentFrame / FPS;

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragIndex, setDragIndex] = useState(-1);
  const dragStartX = useRef(0);
  const dragStartVal = useRef<{ start: number; end: number; audioStart?: number }>({ start: 0, end: 0 });
  const dragOffsetSec = useRef(0);

  const [snapLineX, setSnapLineX] = useState<number | null>(null);

  // Snap points: ALL element boundaries + playhead
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
  snapPoints.push(currentTime);

  const snapToNearest = useCallback((time: number, excludePoints?: number[]): { time: number; snapped: boolean } => {
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
  }, [snapPoints, pxPerSec]);

  // Seek
  const seekToTime = useCallback((time: number) => {
    const frame = Math.max(0, Math.round(time * FPS));
    const seekTo = (window as unknown as Record<string, (f: number) => void>).__studioSeekTo;
    if (seekTo) seekTo(frame);
  }, []);

  const getTimeFromX = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left) / pxPerSec);
  }, [pxPerSec, trackRef]);

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
        const origTimelineStart = dragStartVal.current.audioStart ?? (clips[dragIndex].timelineStart ?? clipStarts[dragIndex]);
        const sourceDelta = rawStart - dragStartVal.current.start;
        const newTimelineStart = origTimelineStart + sourceDelta / speed;
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
      const rawTime = getTimeFromX(e.clientX) - dragOffsetSec.current;
      const newTimelineStart = Math.max(0, rawTime);

      if (!trackRef.current) return;
      const trackRect = trackRef.current.getBoundingClientRect();
      const relY = e.clientY - trackRect.top;
      let newTrack = Math.floor(relY / TRACK_HEIGHT);
      newTrack = NUM_VIDEO_TRACKS - 1 - newTrack;
      newTrack = Math.max(0, Math.min(NUM_VIDEO_TRACKS - 1, newTrack));

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
      const newAudioStart = Math.max(0, origAudioStart + delta);
      const newDuration = Math.max(MIN_CLIP_DURATION, dragStartVal.current.end - delta);
      const origDur = bgm.totalDuration || bgmWaveformDurations.current.get(bgm.source) || 0;
      const maxDuration = origDur > 0 ? origDur - newAudioStart : Infinity;
      updateBgmClip(dragIndex, { start: newStart, audioStart: newAudioStart, duration: Math.min(newDuration, maxDuration) });
    } else if (dragMode === 'bgm-trim-right') {
      let newDuration = Math.max(MIN_CLIP_DURATION, dragStartVal.current.end + deltaSec);
      const bgm = bgmClips[dragIndex];
      if (bgm) {
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
  }, [dragMode, dragIndex, pxPerSec, clipMeta, clipStarts, clipDurations, clips, globalSubs, bgmClips, getTimeFromX, seekToTime, updateClip, moveClip, moveClips, moveClipToTrackAndTime, selectedClipIndices, updateGlobalSub, updateBgmClip, snapToNearest, trackRef, bgmWaveformDurations]);

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

  const startDrag = (mode: DragMode, index: number, e: React.MouseEvent, startVal: { start: number; end: number; audioStart?: number }) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode(mode);
    setDragIndex(index);
    dragStartX.current = e.clientX;
    dragStartVal.current = startVal;
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode) return;
    const rect = (trackRef.current || e.currentTarget).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 0) return;
    seekToTime(x / pxPerSec);
  }, [pxPerSec, seekToTime, dragMode, trackRef]);

  return {
    dragMode,
    dragIndex,
    dragOffsetSec,
    snapLineX,
    startDrag,
    handleTimelineClick,
    getTimeFromX,
    seekToTime,
  };
}
