export type VideoFormat = 'portrait' | 'landscape' | 'square';

export function getVideoFormatConfig(format?: string | null) {
  if (format === 'landscape') {
    return { width: 1920, height: 1080 };
  }
  if (format === 'square') {
    return { width: 1080, height: 1080 };
  }
  return { width: 1080, height: 1920 };
}
