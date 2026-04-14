import { create } from 'zustand';
import type { Clip, ClipMeta, ClipCrop, ClipZoom, ClipSubStyle, Transition, GlobalSub, BgmClip, FadeInOut, GlobalEffect, ProjectData } from './types';
import { NUM_VIDEO_TRACKS } from './types';

type ActivePanel = 'subtitle' | 'clip' | 'bgm' | 'media' | 'transition' | 'reference' | 'effect' | null;

// Snapshot of project data for undo/redo
interface HistoryEntry {
  clips: Clip[];
  clipMeta: ClipMeta[];
  clipCrops: ClipCrop[];
  clipZooms: ClipZoom[];
  clipSubStyles: ClipSubStyle[];
  transitions: Transition[];
  globalSubs: GlobalSub[];
  bgmClips: BgmClip[];
  totalDuration: number;
  sources: string[];
  fadeInOut: FadeInOut;
  globalEffects: GlobalEffect[];
}

type ClipboardData =
  | { type: 'subtitle'; data: GlobalSub }
  | { type: 'clip'; data: { clip: Clip; meta: ClipMeta; crop: ClipCrop; zoom: ClipZoom; subStyle: ClipSubStyle } }
  | null;

interface EditorState {
  // Project data
  projectId: string;
  dbId: string;
  name: string;
  clips: Clip[];
  clipMeta: ClipMeta[];
  clipCrops: ClipCrop[];
  clipZooms: ClipZoom[];
  clipSubStyles: ClipSubStyle[];
  transitions: Transition[];
  globalSubs: GlobalSub[];
  bgmClips: BgmClip[];
  totalDuration: number;
  sources: string[];
  fadeInOut: FadeInOut;
  globalEffects: GlobalEffect[];
  referenceId: string;
  subsEnabled: boolean;
  bgmEnabled: boolean;
  orientation: 'vertical' | 'square' | 'horizontal';

  // UI state
  selectedClipIndex: number;
  selectedClipIndices: number[];
  selectedSubIndex: number;
  currentFrame: number;
  isPlaying: boolean;
  activePanel: ActivePanel;
  pxPerSec: number;

  // Undo/Redo
  _history: HistoryEntry[];
  _historyIndex: number;
  _pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clipboard
  _clipboard: ClipboardData;
  copySubtitle: () => void;
  copyClip: () => void;
  paste: () => void;

  // Actions
  loadProject: (data: ProjectData) => void;
  setName: (name: string) => void;
  setOrientation: (o: 'vertical' | 'square' | 'horizontal') => void;
  setSelectedClipIndex: (i: number) => void;
  toggleClipSelection: (index: number) => void;
  selectClipRange: (from: number, to: number) => void;
  moveClips: (indices: number[], targetIndex: number) => void;
  clearClipSelection: () => void;
  setSelectedSubIndex: (i: number) => void;
  setCurrentFrame: (f: number) => void;
  setIsPlaying: (p: boolean) => void;
  setActivePanel: (p: ActivePanel) => void;
  setPxPerSec: (v: number) => void;

  // Reference
  setReferenceId: (id: string) => void;

  // Toggle subs/bgm visibility
  setSubsEnabled: (v: boolean) => void;
  setBgmEnabled: (v: boolean) => void;

  // Clip mutations
  addClip: (clip: Clip) => void;
  removeClip: (index: number) => void;
  removeClips: (indices: number[]) => void;
  splitClip: (index: number, atTime: number) => void;
  moveClip: (from: number, to: number) => void;
  updateClip: (index: number, partial: Partial<Clip>) => void;
  replaceClipSource: (index: number, newSource: string, newDuration: number) => void;
  moveClipToTrackAndTime: (index: number, track: number, timelineStart: number) => void;
  setClipTrack: (index: number, track: number) => void;

  // Subtitle mutations
  addSubtitle: (sub: GlobalSub) => void;
  removeSubtitle: (index: number) => void;
  updateGlobalSub: (index: number, sub: Partial<GlobalSub>) => void;

  // Clip detail mutations
  updateClipMeta: (index: number, meta: Partial<ClipMeta>) => void;
  setAllClipAudioMuted: (muted: boolean) => void;
  updateClipCrop: (index: number, crop: Partial<ClipCrop>) => void;
  updateClipZoom: (index: number, zoom: Partial<ClipZoom>) => void;

  // BGM mutations
  addBgmClip: (bgm: BgmClip) => void;
  removeBgmClip: (index: number) => void;
  updateBgmClip: (index: number, bgm: Partial<BgmClip>) => void;

  // Transition mutations
  setTransition: (index: number, transition: Partial<Transition>) => void;

  // FadeInOut
  updateFadeInOut: (partial: Partial<FadeInOut>) => void;

  // Global effects
  updateGlobalEffect: (type: GlobalEffect['type'], value: number) => void;

  // Player callbacks (replaces window.__studioSeekTo / __studioPlayerRef)
  _playerSeekTo: ((frame: number) => void) | null;
  _playerToggle: (() => void) | null;
  setPlayerCallbacks: (seekTo: (frame: number) => void, toggle: () => void) => void;
  clearPlayerCallbacks: () => void;
  seekToFrame: (frame: number) => void;
  togglePlayback: () => void;

  // Export
  exportSrt: () => void;

  recalcDuration: () => void;

  // Computed
  getProjectData: () => ProjectData;
}

function calcTotalDuration(clips: Clip[], clipMeta: ClipMeta[], transitions: Transition[]): number {
  if (clips.length === 0) return 0;

  // Multi-track mode: clips에 timelineStart가 하나라도 있으면 절대 위치 기반 계산
  const hasTimelineStart = clips.some((c) => c.timelineStart != null);
  if (hasTimelineStart) {
    let maxEnd = 0;
    for (let i = 0; i < clips.length; i++) {
      const speed = clipMeta[i]?.speed ?? 1;
      const dur = (clips[i].end - clips[i].start) / speed;
      const start = clips[i].timelineStart ?? 0;
      const end = start + dur;
      if (end > maxEnd) maxEnd = end;
    }
    return Math.max(0, maxEnd);
  }

  // Legacy sequential mode
  const clipDurations = clips.map((clip, i) => {
    const speed = clipMeta[i]?.speed ?? 1;
    return (clip.end - clip.start) / speed;
  });

  let total = clipDurations.reduce((a, b) => a + b, 0);
  for (let i = 0; i < clips.length - 1; i++) {
    const t = transitions[i];
    if (t && t.type !== 'none' && t.duration > 0) {
      total -= t.duration;
    }
  }
  return Math.max(0, total);
}

const MAX_HISTORY = 50;

function takeSnapshot(state: EditorState): HistoryEntry {
  return {
    clips: state.clips.map((c) => ({ ...c })),
    clipMeta: state.clipMeta.map((m) => ({ ...m })),
    clipCrops: state.clipCrops.map((c) => ({ ...c })),
    clipZooms: state.clipZooms.map((z) => ({ ...z })),
    clipSubStyles: state.clipSubStyles.map((s) => ({ ...s })),
    transitions: state.transitions.map((t) => ({ ...t })),
    globalSubs: state.globalSubs.map((s) => ({ ...s, style: { ...s.style } })),
    bgmClips: state.bgmClips.map((b) => ({ ...b })),
    totalDuration: state.totalDuration,
    sources: [...state.sources],
    fadeInOut: { ...state.fadeInOut },
    globalEffects: state.globalEffects.map((e) => ({ ...e })),
  };
}

function restoreSnapshot(entry: HistoryEntry): Partial<EditorState> {
  return {
    clips: entry.clips,
    clipMeta: entry.clipMeta,
    clipCrops: entry.clipCrops,
    clipZooms: entry.clipZooms,
    clipSubStyles: entry.clipSubStyles,
    transitions: entry.transitions,
    globalSubs: entry.globalSubs,
    bgmClips: entry.bgmClips,
    totalDuration: entry.totalDuration,
    sources: entry.sources,
    fadeInOut: entry.fadeInOut,
    globalEffects: entry.globalEffects,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectId: '',
  dbId: '',
  name: '',
  clips: [],
  clipMeta: [],
  clipCrops: [],
  clipZooms: [],
  clipSubStyles: [],
  transitions: [],
  globalSubs: [],
  bgmClips: [],
  totalDuration: 0,
  sources: [],
  referenceId: '',
  subsEnabled: true,
  bgmEnabled: true,
  orientation: 'vertical',
  fadeInOut: { enabled: false, fadeInDuration: 0.5, fadeOutDuration: 0.5 },
  globalEffects: [
    { type: 'brightness', value: 100 },
    { type: 'contrast', value: 100 },
    { type: 'saturation', value: 100 },
    { type: 'blur', value: 0 },
    { type: 'grayscale', value: 0 },
    { type: 'sepia', value: 0 },
    { type: 'hueRotate', value: 0 },
  ],

  selectedClipIndex: -1,
  selectedClipIndices: [],
  selectedSubIndex: -1,
  currentFrame: 0,
  isPlaying: false,
  activePanel: "subtitle",
  pxPerSec: 80,

  // Undo/Redo
  _history: [],
  _historyIndex: -1,

  _pushHistory: () => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const history = state._history.slice(0, state._historyIndex + 1);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    set({ _history: history, _historyIndex: history.length - 1 });
  },

  undo: () => {
    const state = get();
    if (state._historyIndex < 0) return;
    // Save current state as redo point if at the end
    const history = [...state._history];
    if (state._historyIndex === history.length - 1) {
      const current = takeSnapshot(state);
      history.push(current);
    }
    const entry = history[state._historyIndex];
    set({
      ...restoreSnapshot(entry),
      _history: history,
      _historyIndex: state._historyIndex - 1,
    });
  },

  redo: () => {
    const state = get();
    if (state._historyIndex >= state._history.length - 2) return;
    const newIndex = state._historyIndex + 2;
    const entry = state._history[newIndex];
    if (!entry) return;
    set({
      ...restoreSnapshot(entry),
      _historyIndex: newIndex,
    });
  },

  canUndo: () => get()._historyIndex >= 0,
  canRedo: () => {
    const s = get();
    return s._historyIndex < s._history.length - 2;
  },

  // Clipboard
  _clipboard: null,

  copySubtitle: () => {
    const state = get();
    const sub = state.globalSubs[state.selectedSubIndex];
    if (!sub) return;
    set({ _clipboard: { type: 'subtitle', data: { ...sub, style: { ...sub.style } } } });
  },

  copyClip: () => {
    const state = get();
    const i = state.selectedClipIndex;
    if (i < 0 || i >= state.clips.length) return;
    set({
      _clipboard: {
        type: 'clip',
        data: {
          clip: { ...state.clips[i] },
          meta: { ...state.clipMeta[i] },
          crop: { ...state.clipCrops[i] },
          zoom: { ...state.clipZooms[i] },
          subStyle: { ...state.clipSubStyles[i] },
        },
      },
    });
  },

  paste: () => {
    const state = get();
    const cb = state._clipboard;
    if (!cb) return;

    state._pushHistory();

    if (cb.type === 'subtitle') {
      const currentTime = state.currentFrame / 30;
      const dur = cb.data.end - cb.data.start;
      const newSub: GlobalSub = {
        ...cb.data,
        style: { ...cb.data.style },
        start: currentTime,
        end: currentTime + dur,
      };
      const globalSubs = [...state.globalSubs, newSub];
      set({ globalSubs, selectedSubIndex: globalSubs.length - 1, activePanel: 'subtitle' as ActivePanel });
    } else if (cb.type === 'clip') {
      const { clip, meta, crop, zoom, subStyle } = cb.data;
      const clips = [...state.clips, { ...clip }];
      const clipMeta = [...state.clipMeta, { ...meta }];
      const clipCrops = [...state.clipCrops, { ...crop }];
      const clipZooms = [...state.clipZooms, { ...zoom }];
      const clipSubStyles = [...state.clipSubStyles, { ...subStyle }];
      const transitions = [...state.transitions];
      if (clips.length > 1 && transitions.length < clips.length - 1) {
        transitions.push({ type: 'none', duration: 0 });
      }
      const sources = state.sources.includes(clip.source) ? state.sources : [...state.sources, clip.source];
      const totalDuration = calcTotalDuration(clips, clipMeta, transitions);
      set({
        clips, clipMeta, clipCrops, clipZooms, clipSubStyles, transitions, sources, totalDuration,
        selectedClipIndex: clips.length - 1, activePanel: 'clip' as ActivePanel,
      });
    }
  },

  loadProject: (data) => {
    const rawClips = data.clips || [];
    const clipMeta = (data.clipMeta || rawClips.map(() => ({ speed: 1 }))).map((meta) => ({
      speed: meta?.speed ?? 1,
      opacity: meta?.opacity,
      rotation: meta?.rotation,
      volume: meta?.volume ?? 100,
      audioMuted: meta?.audioMuted ?? false,
      fitMode: meta?.fitMode ?? 'cover',
      positionX: meta?.positionX,
      positionY: meta?.positionY,
    }));
    const transitions = data.transitions || [];

    // 마이그레이션: timelineStart가 없는 기존 프로젝트에 순차 위치 스탬프
    const needsMigration = rawClips.length > 0 && rawClips.every((c) => c.timelineStart == null);
    const clips: Clip[] = rawClips.map((c, i) => ({ ...c }));
    if (needsMigration) {
      let cursor = 0;
      for (let i = 0; i < clips.length; i++) {
        clips[i].timelineStart = cursor;
        clips[i].track = clips[i].track ?? 0;
        const speed = clipMeta[i]?.speed ?? 1;
        const dur = (clips[i].end - clips[i].start) / speed;
        const t = transitions[i];
        const overlap = t && t.type !== 'none' && t.duration > 0 ? t.duration : 0;
        cursor += dur - overlap;
      }
    } else {
      // track 기본값 보장
      for (let i = 0; i < clips.length; i++) {
        clips[i].track = clips[i].track ?? 0;
        clips[i].timelineStart = clips[i].timelineStart ?? 0;
      }
    }

    const totalDuration = data.totalDuration || calcTotalDuration(clips, clipMeta, transitions);

    set({
      projectId: data.id || '',
      dbId: (data as unknown as Record<string, unknown>).dbId as string || data.id || '',
      name: data.name || '',
      clips,
      clipMeta,
      clipCrops: data.clipCrops || clips.map(() => ({ x: 0, y: 0, w: 100, h: 100 })),
      clipZooms: data.clipZooms || clips.map(() => ({ scale: 1, panX: 0, panY: 0 })),
      clipSubStyles: data.clipSubStyles || clips.map(() => ({ size: 16, x: 50, y: 80, font: "'BMDOHYEON',sans-serif" })),
      transitions,
      globalSubs: data.globalSubs || [],
      bgmClips: data.bgmClips || [],
      totalDuration,
      sources: data.sources || [],
      fadeInOut: data.fadeInOut?.fadeInDuration !== undefined
        ? data.fadeInOut
        : {
            enabled: (data.fadeInOut as unknown as Record<string, Record<string, unknown>>)?.fadeIn?.enabled as boolean || (data.fadeInOut as unknown as Record<string, Record<string, unknown>>)?.fadeOut?.enabled as boolean || false,
            fadeInDuration: ((data.fadeInOut as unknown as Record<string, Record<string, unknown>>)?.fadeIn?.duration as number) ?? 0.5,
            fadeOutDuration: ((data.fadeInOut as unknown as Record<string, Record<string, unknown>>)?.fadeOut?.duration as number) ?? 0.5,
          },
      globalEffects: (() => {
        const defaults: GlobalEffect[] = [
          { type: 'brightness', value: 100 },
          { type: 'contrast', value: 100 },
          { type: 'saturation', value: 100 },
          { type: 'blur', value: 0 },
          { type: 'grayscale', value: 0 },
          { type: 'sepia', value: 0 },
          { type: 'hueRotate', value: 0 },
        ];
        if (!Array.isArray(data.globalEffects) || data.globalEffects.length === 0) return defaults;
        const saved = data.globalEffects as GlobalEffect[];
        return defaults.map((d) => {
          const found = saved.find((s) => s.type === d.type);
          return found ? { ...d, value: found.value } : d;
        });
      })(),
      referenceId: (data as ProjectData & { referenceId?: string }).referenceId || '',
      orientation: ((data as ProjectData & { orientation?: string }).orientation as 'vertical' | 'square' | 'horizontal') || 'vertical',
      subsEnabled: (data as ProjectData & { subsEnabled?: boolean }).subsEnabled !== false,
      bgmEnabled: (data as ProjectData & { bgmEnabled?: boolean }).bgmEnabled !== false,
      selectedClipIndex: clips.length > 0 ? 0 : -1,
      selectedClipIndices: clips.length > 0 ? [0] : [],
      selectedSubIndex: -1,
      currentFrame: 0,
      isPlaying: false,
      activePanel: null,
      _history: [],
      _historyIndex: -1,
    });
  },

  setName: (name) => set({ name }),
  setOrientation: (orientation) => set({ orientation }),
  setReferenceId: (id) => set({ referenceId: id }),
  setSubsEnabled: (v) => set({ subsEnabled: v }),
  setBgmEnabled: (v) => set({ bgmEnabled: v }),
  setSelectedClipIndex: (i) => set({ selectedClipIndex: i, selectedClipIndices: i >= 0 ? [i] : [], activePanel: 'clip' }),

  toggleClipSelection: (index) => {
    const state = get();
    const indices = [...state.selectedClipIndices];
    const pos = indices.indexOf(index);
    if (pos >= 0) {
      indices.splice(pos, 1);
    } else {
      indices.push(index);
    }
    const lastSelected = indices.length > 0 ? indices[indices.length - 1] : -1;
    set({ selectedClipIndices: indices, selectedClipIndex: lastSelected, activePanel: 'clip' });
  },

  selectClipRange: (from, to) => {
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    const indices: number[] = [];
    for (let i = min; i <= max; i++) {
      indices.push(i);
    }
    set({ selectedClipIndices: indices, selectedClipIndex: to, activePanel: 'clip' });
  },

  moveClips: (indices, targetIndex) => {
    get()._pushHistory();
    set((state) => {
      const sorted = [...indices].sort((a, b) => a - b);
      // Validate indices
      if (sorted.some((i) => i < 0 || i >= state.clips.length)) return state;
      if (targetIndex < 0 || targetIndex > state.clips.length) return state;
      // If all indices are already at target position range, skip
      if (sorted.length === 0) return state;

      // Extract selected items
      const extractedClips = sorted.map((i) => state.clips[i]);
      const extractedMeta = sorted.map((i) => state.clipMeta[i]);
      const extractedCrops = sorted.map((i) => state.clipCrops[i]);
      const extractedZooms = sorted.map((i) => state.clipZooms[i]);
      const extractedSubStyles = sorted.map((i) => state.clipSubStyles[i]);

      // Remove selected items (from end to start to preserve indices)
      const removeSet = new Set(sorted);
      const remainClips = state.clips.filter((_, i) => !removeSet.has(i));
      const remainMeta = state.clipMeta.filter((_, i) => !removeSet.has(i));
      const remainCrops = state.clipCrops.filter((_, i) => !removeSet.has(i));
      const remainZooms = state.clipZooms.filter((_, i) => !removeSet.has(i));
      const remainSubStyles = state.clipSubStyles.filter((_, i) => !removeSet.has(i));

      // Calculate adjusted target index (account for removed items before target)
      let adjustedTarget = targetIndex;
      for (const idx of sorted) {
        if (idx < targetIndex) adjustedTarget--;
      }
      adjustedTarget = Math.max(0, Math.min(adjustedTarget, remainClips.length));

      // Insert at target position
      const clips = [...remainClips.slice(0, adjustedTarget), ...extractedClips, ...remainClips.slice(adjustedTarget)];
      const clipMeta = [...remainMeta.slice(0, adjustedTarget), ...extractedMeta, ...remainMeta.slice(adjustedTarget)];
      const clipCrops = [...remainCrops.slice(0, adjustedTarget), ...extractedCrops, ...remainCrops.slice(adjustedTarget)];
      const clipZooms = [...remainZooms.slice(0, adjustedTarget), ...extractedZooms, ...remainZooms.slice(adjustedTarget)];
      const clipSubStyles = [...remainSubStyles.slice(0, adjustedTarget), ...extractedSubStyles, ...remainSubStyles.slice(adjustedTarget)];

      const totalDuration = calcTotalDuration(clips, clipMeta, state.transitions);

      // Update selected indices to new positions
      const newIndices = extractedClips.map((_, i) => adjustedTarget + i);

      return {
        clips, clipMeta, clipCrops, clipZooms, clipSubStyles, totalDuration,
        selectedClipIndices: newIndices,
        selectedClipIndex: newIndices[newIndices.length - 1],
      };
    });
  },

  clearClipSelection: () => set({ selectedClipIndices: [], selectedClipIndex: -1 }),

  setSelectedSubIndex: (i) => set({ selectedSubIndex: i, activePanel: 'subtitle' }),
  setCurrentFrame: (f) => set({ currentFrame: f }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setActivePanel: (p) => set({ activePanel: p }),
  setPxPerSec: (v) => set({ pxPerSec: Math.max(20, Math.min(400, v)) }),

  // Clip mutations
  addClip: (clip) => {
    get()._pushHistory();
    set((state) => {
      // 트랙 0의 끝 위치 계산
      let track0End = 0;
      for (let i = 0; i < state.clips.length; i++) {
        if ((state.clips[i].track ?? 0) === 0) {
          const speed = state.clipMeta[i]?.speed ?? 1;
          const dur = (state.clips[i].end - state.clips[i].start) / speed;
          const clipEnd = (state.clips[i].timelineStart ?? 0) + dur;
          if (clipEnd > track0End) track0End = clipEnd;
        }
      }
      const newClip: Clip = { ...clip, track: clip.track ?? 0, timelineStart: clip.timelineStart ?? track0End };
      const clips = [...state.clips, newClip];
      const clipMeta = [...state.clipMeta, { speed: 1, volume: 100, audioMuted: false, fitMode: 'cover' as const }];
      const clipCrops = [...state.clipCrops, { x: 0, y: 0, w: 100, h: 100 }];
      const clipZooms = [...state.clipZooms, { scale: 1, panX: 0, panY: 0 }];
      const clipSubStyles = [...state.clipSubStyles, { size: 16, x: 50, y: 80, font: "'BMDOHYEON',sans-serif" }];
      const transitions = [...state.transitions];
      if (clips.length > 1 && transitions.length < clips.length - 1) {
        transitions.push({ type: 'none', duration: 0 });
      }
      const sources = state.sources.includes(clip.source) ? state.sources : [...state.sources, clip.source];
      const totalDuration = calcTotalDuration(clips, clipMeta, transitions);
      return { clips, clipMeta, clipCrops, clipZooms, clipSubStyles, transitions, sources, totalDuration, selectedClipIndex: clips.length - 1, activePanel: 'clip' as ActivePanel };
    });
  },

  removeClip: (index) => {
    get()._pushHistory();
    set((state) => {
      if (index < 0 || index >= state.clips.length) return state;
      const clips = state.clips.filter((_, i) => i !== index);
      const clipMeta = state.clipMeta.filter((_, i) => i !== index);
      const clipCrops = state.clipCrops.filter((_, i) => i !== index);
      const clipZooms = state.clipZooms.filter((_, i) => i !== index);
      const clipSubStyles = state.clipSubStyles.filter((_, i) => i !== index);
      const transitions = state.transitions.filter((_, i) => i !== index && i !== index - 1).slice(0, Math.max(0, clips.length - 1));
      const totalDuration = calcTotalDuration(clips, clipMeta, transitions);
      const selectedClipIndex = clips.length === 0 ? -1 : Math.min(state.selectedClipIndex, clips.length - 1);
      return { clips, clipMeta, clipCrops, clipZooms, clipSubStyles, transitions, totalDuration, selectedClipIndex };
    });
  },

  removeClips: (indices) => {
    if (indices.length === 0) return;
    get()._pushHistory();
    set((state) => {
      const toRemove = new Set(indices);
      const clips = state.clips.filter((_, i) => !toRemove.has(i));
      const clipMeta = state.clipMeta.filter((_, i) => !toRemove.has(i));
      const clipCrops = state.clipCrops.filter((_, i) => !toRemove.has(i));
      const clipZooms = state.clipZooms.filter((_, i) => !toRemove.has(i));
      const clipSubStyles = state.clipSubStyles.filter((_, i) => !toRemove.has(i));
      const transitions = state.transitions.filter((_, i) => !toRemove.has(i)).slice(0, Math.max(0, clips.length - 1));
      const totalDuration = calcTotalDuration(clips, clipMeta, transitions);
      return { clips, clipMeta, clipCrops, clipZooms, clipSubStyles, transitions, totalDuration, selectedClipIndex: -1, selectedClipIndices: [] };
    });
  },

  splitClip: (index, atTime) => {
    get()._pushHistory();
    set((state) => {
      const clip = state.clips[index];
      if (!clip || atTime <= clip.start || atTime >= clip.end) return state;
      const speed = state.clipMeta[index]?.speed ?? 1;
      const firstDur = (atTime - clip.start) / speed;
      const clip1: Clip = { ...clip, end: atTime };
      const clip2: Clip = {
        ...clip,
        start: atTime,
        source_idx: clip.source_idx,
        track: clip.track ?? 0,
        timelineStart: (clip.timelineStart ?? 0) + firstDur,
      };
      const meta = state.clipMeta[index] || { speed: 1 };
      const crop = state.clipCrops[index] || { x: 0, y: 0, w: 100, h: 100 };
      const zoom = state.clipZooms[index] || { scale: 1, panX: 0, panY: 0 };
      const subStyle = state.clipSubStyles[index] || {};
      const insert = <T,>(arr: T[], i: number, item: T) => [...arr.slice(0, i + 1), item, ...arr.slice(i + 1)];
      const clips = [...state.clips]; clips.splice(index, 1, clip1, clip2);
      const clipMeta = insert(state.clipMeta, index, { ...meta });
      const clipCrops = insert(state.clipCrops, index, { ...crop });
      const clipZooms = insert(state.clipZooms, index, { ...zoom });
      const clipSubStyles = insert(state.clipSubStyles, index, { ...subStyle });
      const transitions = insert(state.transitions, index, { type: 'none', duration: 0 });
      const totalDuration = calcTotalDuration(clips, clipMeta, transitions);
      return { clips, clipMeta, clipCrops, clipZooms, clipSubStyles, transitions, totalDuration, selectedClipIndex: index + 1 };
    });
  },

  moveClip: (from, to) => {
    get()._pushHistory();
    set((state) => {
      if (from === to || from < 0 || to < 0 || from >= state.clips.length || to >= state.clips.length) return state;
      const move = <T,>(arr: T[]) => {
        const a = [...arr];
        const [item] = a.splice(from, 1);
        a.splice(to, 0, item);
        return a;
      };
      const clips = move(state.clips);
      const clipMeta = move(state.clipMeta);
      const clipCrops = move(state.clipCrops);
      const clipZooms = move(state.clipZooms);
      const clipSubStyles = move(state.clipSubStyles);
      const totalDuration = calcTotalDuration(clips, clipMeta, state.transitions);
      return { clips, clipMeta, clipCrops, clipZooms, clipSubStyles, totalDuration, selectedClipIndex: to };
    });
  },

  updateClip: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const updatedClip = { ...state.clips[index], ...partial };

      // 타임라인 위치/길이가 변경되는 경우에만 겹침 체크
      // timelineStart 변경 또는 클립 타임라인 길이가 달라지는 경우
      const oldClip = state.clips[index];
      const speed = state.clipMeta[index]?.speed ?? 1;
      const oldTimelineDur = (oldClip.end - oldClip.start) / speed;
      const newTimelineDur = (updatedClip.end - updatedClip.start) / speed;
      const timelineStartChanged = partial.timelineStart !== undefined && partial.timelineStart !== (oldClip.timelineStart ?? 0);
      const timelineDurChanged = Math.abs(newTimelineDur - oldTimelineDur) > 0.001;

      if (timelineStartChanged || timelineDurChanged) {
        const track = updatedClip.track ?? 0;
        const clipTlStart = updatedClip.timelineStart ?? 0;
        const clipTlEnd = clipTlStart + newTimelineDur;
        for (let i = 0; i < state.clips.length; i++) {
          if (i === index) continue;
          if ((state.clips[i].track ?? 0) !== track) continue;
          const otherStart = state.clips[i].timelineStart ?? 0;
          const otherSpeed = state.clipMeta[i]?.speed ?? 1;
          const otherEnd = otherStart + (state.clips[i].end - state.clips[i].start) / otherSpeed;
          if (clipTlStart < otherEnd && clipTlEnd > otherStart) {
            return state; // 겹침 → 변경 취소
          }
        }
      }

      const clips = [...state.clips];
      clips[index] = updatedClip;
      const totalDuration = calcTotalDuration(clips, state.clipMeta, state.transitions);
      return { clips, totalDuration };
    });
  },

  replaceClipSource: (index, newSource, newDuration) => {
    get()._pushHistory();
    set((state) => {
      const clips = [...state.clips];
      if (index < 0 || index >= clips.length) return state;
      const oldClip = clips[index];
      const oldDuration = oldClip.end - oldClip.start;
      // 기존 타임라인 길이 유지, 새 영상이 더 짧으면 새 영상 길이로 제한
      const keepDuration = Math.min(oldDuration, newDuration);
      clips[index] = { ...oldClip, source: newSource, start: 0, end: keepDuration };
      const sources = state.sources.includes(newSource) ? state.sources : [...state.sources, newSource];
      const totalDuration = calcTotalDuration(clips, state.clipMeta, state.transitions);
      return { clips, sources, totalDuration };
    });
  },

  moveClipToTrackAndTime: (index, track, timelineStart) => {
    get()._pushHistory();
    set((state) => {
      if (index < 0 || index >= state.clips.length) return state;
      const clampedTrack = Math.max(0, Math.min(NUM_VIDEO_TRACKS - 1, track));
      const newStart = Math.max(0, timelineStart);
      const speed = state.clipMeta[index]?.speed ?? 1;
      const clipDur = (state.clips[index].end - state.clips[index].start) / speed;
      const newEnd = newStart + clipDur;

      // 같은 트랙의 다른 클립과 겹치는지 확인
      for (let i = 0; i < state.clips.length; i++) {
        if (i === index) continue;
        const otherTrack = state.clips[i].track ?? 0;
        if (otherTrack !== clampedTrack) continue;
        const otherStart = state.clips[i].timelineStart ?? 0;
        const otherSpeed = state.clipMeta[i]?.speed ?? 1;
        const otherEnd = otherStart + (state.clips[i].end - state.clips[i].start) / otherSpeed;
        if (newStart < otherEnd && newEnd > otherStart) {
          // 겹침 → 이동 취소
          return state;
        }
      }

      const clips = [...state.clips];
      clips[index] = { ...clips[index], track: clampedTrack, timelineStart: newStart };
      const totalDuration = calcTotalDuration(clips, state.clipMeta, state.transitions);
      return { clips, totalDuration };
    });
  },

  setClipTrack: (index, track) => {
    get()._pushHistory();
    set((state) => {
      if (index < 0 || index >= state.clips.length) return state;
      const clampedTrack = Math.max(0, Math.min(NUM_VIDEO_TRACKS - 1, track));
      const clips = [...state.clips];
      clips[index] = { ...clips[index], track: clampedTrack };
      return { clips };
    });
  },

  // Subtitle mutations
  addSubtitle: (sub) => {
    get()._pushHistory();
    set((state) => {
      const globalSubs = [...state.globalSubs, sub];
      return { globalSubs, selectedSubIndex: globalSubs.length - 1, activePanel: 'subtitle' as ActivePanel };
    });
  },

  removeSubtitle: (index) => {
    get()._pushHistory();
    set((state) => {
      if (index < 0 || index >= state.globalSubs.length) return state;
      const globalSubs = state.globalSubs.filter((_, i) => i !== index);
      const selectedSubIndex = globalSubs.length === 0 ? -1 : Math.min(state.selectedSubIndex, globalSubs.length - 1);
      return { globalSubs, selectedSubIndex };
    });
  },

  updateGlobalSub: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const subs = [...state.globalSubs];
      const existing = subs[index];
      const { style: partialStyle, ...rest } = partial;
      subs[index] = {
        ...existing,
        ...rest,
        style: partialStyle ? { ...existing.style, ...partialStyle } : existing.style,
      };
      return { globalSubs: subs };
    });
  },

  updateClipMeta: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const meta = [...state.clipMeta];
      meta[index] = { ...meta[index], ...partial };
      const totalDuration = calcTotalDuration(state.clips, meta, state.transitions);
      return { clipMeta: meta, totalDuration };
    });
  },

  setAllClipAudioMuted: (muted) => {
    get()._pushHistory();
    set((state) => {
      const clipMeta = state.clipMeta.map((meta) => ({
        ...meta,
        volume: meta?.volume ?? 100,
        audioMuted: muted,
      }));
      const totalDuration = calcTotalDuration(state.clips, clipMeta, state.transitions);
      return { clipMeta, totalDuration };
    });
  },

  updateClipCrop: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const crops = [...state.clipCrops];
      crops[index] = { ...crops[index], ...partial };
      return { clipCrops: crops };
    });
  },

  updateClipZoom: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const zooms = [...state.clipZooms];
      zooms[index] = { ...zooms[index], ...partial };
      return { clipZooms: zooms };
    });
  },

  // BGM mutations
  addBgmClip: (bgm) => {
    get()._pushHistory();
    set((state) => ({
      bgmClips: [...state.bgmClips, bgm],
      activePanel: 'bgm' as ActivePanel,
    }));
  },

  removeBgmClip: (index) => {
    get()._pushHistory();
    set((state) => ({
      bgmClips: state.bgmClips.filter((_, i) => i !== index),
    }));
  },

  updateBgmClip: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const bgm = [...state.bgmClips];
      bgm[index] = { ...bgm[index], ...partial };
      return { bgmClips: bgm };
    });
  },

  // Transition mutations
  setTransition: (index, partial) => {
    get()._pushHistory();
    set((state) => {
      const transitions = [...state.transitions];
      while (transitions.length <= index) {
        transitions.push({ type: 'none', duration: 0 });
      }
      transitions[index] = { ...transitions[index], ...partial };
      const totalDuration = calcTotalDuration(state.clips, state.clipMeta, transitions);
      return { transitions, totalDuration };
    });
  },

  // FadeInOut
  updateFadeInOut: (partial) => {
    get()._pushHistory();
    set((state) => ({
      fadeInOut: { ...state.fadeInOut, ...partial },
    }));
  },

  // Global effects
  updateGlobalEffect: (type, value) => {
    get()._pushHistory();
    set((state) => ({
      globalEffects: state.globalEffects.map((ef) =>
        ef.type === type ? { ...ef, value } : ef
      ),
    }));
  },

  // Player callbacks
  _playerSeekTo: null,
  _playerToggle: null,
  setPlayerCallbacks: (seekTo, toggle) => set({ _playerSeekTo: seekTo, _playerToggle: toggle }),
  clearPlayerCallbacks: () => set({ _playerSeekTo: null, _playerToggle: null }),
  seekToFrame: (frame) => { const fn = get()._playerSeekTo; if (fn) fn(frame); },
  togglePlayback: () => { const fn = get()._playerToggle; if (fn) fn(); },

  // Export SRT
  exportSrt: () => {
    const subs = get().globalSubs;
    const pad = (n: number) => String(n).padStart(2, '0');
    const srtTime = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.round((sec % 1) * 1000);
      return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
    };
    let text = '';
    let n = 1;
    for (const sub of subs) {
      if (!sub.text) continue;
      text += `${n}\n${srtTime(sub.start)} --> ${srtTime(sub.end)}\n${sub.text}\n\n`;
      n++;
    }
    const blob = new Blob([text], { type: 'text/srt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${get().name || 'subtitles'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  },

  recalcDuration: () => set((state) => ({
    totalDuration: calcTotalDuration(state.clips, state.clipMeta, state.transitions),
  })),

  getProjectData: () => {
    const s = get();
    return {
      id: s.projectId,
      dbId: s.dbId,
      name: s.name,
      clips: s.clips,
      clipMeta: s.clipMeta,
      clipCrops: s.clipCrops,
      clipZooms: s.clipZooms,
      clipSubStyles: s.clipSubStyles,
      transitions: s.transitions,
      subs: [],
      globalSubs: s.globalSubs,
      bgmClips: s.bgmClips,
      totalDuration: s.totalDuration,
      sources: s.sources,
      fadeInOut: s.fadeInOut,
      globalEffects: s.globalEffects,
      referenceId: s.referenceId,
      orientation: s.orientation,
      subsEnabled: s.subsEnabled,
      bgmEnabled: s.bgmEnabled,
      mediaBasePath: '',
    };
  },
}));
