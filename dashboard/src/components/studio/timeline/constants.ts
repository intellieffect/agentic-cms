export const FPS = 30;
export const TRACK_HEIGHT = 48;
export const CLIP_AUDIO_TRACK_HEIGHT = 32;
export const HEADER_W = 60;
export const TRIM_HANDLE_W = 6;
export const MIN_CLIP_DURATION = 0.1;
export const SNAP_THRESHOLD_PX = 8;

export type ClipAudioInfo = {
  hasAudio: boolean;
};

export type DragMode =
  | null
  | 'playhead'
  | 'clip-move'
  | 'clip-trim-left'
  | 'clip-trim-right'
  | 'sub-move'
  | 'sub-trim-left'
  | 'sub-trim-right'
  | 'bgm-move'
  | 'bgm-trim-left'
  | 'bgm-trim-right';
