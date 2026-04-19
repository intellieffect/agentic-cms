export type VideoFormat = 'portrait' | 'landscape' | 'square';

export interface VideoFormatConfig {
  key: VideoFormat;
  label: string;
  width: number;
  height: number;
}

export const VIDEO_FORMATS: Record<VideoFormat, VideoFormatConfig> = {
  portrait: { key: 'portrait', label: '세로', width: 1080, height: 1920 },
  landscape: { key: 'landscape', label: '가로', width: 1920, height: 1080 },
  square: { key: 'square', label: '정방형', width: 1080, height: 1080 },
};

export const DEFAULT_VIDEO_FORMAT: VideoFormat = 'portrait';

export function getVideoFormatConfig(format?: string | null): VideoFormatConfig {
  if (format && format in VIDEO_FORMATS) {
    return VIDEO_FORMATS[format as VideoFormat];
  }
  return VIDEO_FORMATS[DEFAULT_VIDEO_FORMAT];
}
