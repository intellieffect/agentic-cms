// Types matching brxce-editor project JSON — shared between store and components

import type { SubtitleEffect } from './remotion-types';

export const NUM_VIDEO_TRACKS = 3;

export interface Clip {
  source: string;
  start: number;
  end: number;
  source_idx: number;
  track?: number;          // 0-2, default 0
  timelineStart?: number;  // 초 단위 절대 위치
}

export interface ClipMeta {
  speed: number;
  opacity?: number;   // 0-100, default 100
  rotation?: number;  // -360 to 360, default 0
  volume?: number;    // 0-100, default 100 (clip original audio volume)
  audioMuted?: boolean; // true면 원본 영상 오디오 음소거
  fitMode?: 'cover' | 'contain'; // cover=세로 꽉 채우기, contain=가로 맞춤+레터박스
  positionX?: number; // 0-100, default 50 (objectPosition X — 0=왼쪽, 50=가운데, 100=오른쪽)
  positionY?: number; // 0-100, default 50 (objectPosition Y — 0=위, 50=가운데, 100=아래)
}

export interface ClipCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClipZoom {
  scale: number;
  panX: number;
  panY: number;
  // Animated zoom: interpolates from start→end over clip duration
  animation?: 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'custom';
  scaleEnd?: number;   // end scale (for custom)
  panXEnd?: number;    // end panX (for custom)
  panYEnd?: number;    // end panY (for custom)
}

export interface ClipSubStyle {
  size: number;
  x: number;
  y: number;
  font: string;
}

export interface Transition {
  type: string;
  duration: number;
}

export interface SubStyle {
  size?: number;
  x?: number;
  y?: number;
  color?: string;
  font?: string;
  bg?: boolean;
  bgColor?: string;
  bgAlpha?: number;
  lineHeight?: number;
  textAlign?: string;
  boxWidth?: number;
  highlightColor?: string;
}

export interface GlobalSub {
  text: string;
  start: number;
  end: number;
  style: SubStyle;
  effect?: SubtitleEffect;
}

export interface BgmClip {
  id?: string;
  source: string;
  start: number;
  audioStart: number;
  duration: number;
  totalDuration?: number;
  volume: number;
  sectionType?: string;
}

export interface FadeInOut {
  enabled: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface GlobalEffect {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale' | 'sepia' | 'hueRotate';
  value: number; // brightness/contrast/saturation: 0-200 (100=default), blur: 0-20 (0=default), grayscale/sepia: 0-100 (0=default), hueRotate: 0-360 (0=default)
}

export interface ProjectData {
  clips: Clip[];
  clipMeta: ClipMeta[];
  clipCrops: ClipCrop[];
  clipZooms: ClipZoom[];
  clipSubStyles: ClipSubStyle[];
  transitions: Transition[];
  subs: unknown[];
  globalSubs: GlobalSub[];
  bgmClips: BgmClip[];
  totalDuration: number;
  sources: string[];
  mediaBasePath?: string;
  // extra fields from API
  id?: string;
  name?: string;
  globalEffects?: GlobalEffect[];
  clipEffects?: unknown[];
  fadeInOut?: FadeInOut;
  kbEffects?: unknown[];
  referenceId?: string;
  subsEnabled?: boolean;
  bgmEnabled?: boolean;
}
