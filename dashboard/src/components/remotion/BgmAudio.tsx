import React, { useCallback } from "react";
import { Audio, interpolate } from "remotion";
import { getEditorConfig } from "@/lib/editor-config";

export interface BgmClipData {
  id?: string;
  source: string;
  start: number; // timeline position (seconds)
  audioStart: number; // position in audio file (seconds)
  duration: number;
  totalDuration?: number;
  volume: number; // 0-100
  sectionType?: string;
}

interface FadeInOut {
  enabled: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

interface BgmAudioProps {
  bgmClip: BgmClipData;
  fps: number;
  mediaBasePath: string;
  fadeInOut?: FadeInOut;
  totalDuration?: number;
}

export const BgmAudio: React.FC<BgmAudioProps> = ({
  bgmClip,
  fps,
  mediaBasePath,
  fadeInOut,
  totalDuration = 0,
}) => {
  const src = mediaBasePath
    ? `${mediaBasePath}/${bgmClip.source}`
    : `${getEditorConfig().apiUrl}${getEditorConfig().mediaProxyPrefix}/${bgmClip.source}`;

  const startFromFrame = Math.round(bgmClip.audioStart * fps);
  const baseVolume = bgmClip.volume / 100;

  // Stabilize fadeInOut deps by extracting primitives — 객체 참조 변경에 무관하게 동일 callback 유지
  const fadeEnabled = !!fadeInOut?.enabled && totalDuration > 0;
  const fadeInDuration = fadeInOut?.fadeInDuration ?? 0;
  const fadeOutDuration = fadeInOut?.fadeOutDuration ?? 0;
  const bgmStart = bgmClip.start;

  const getVolume = useCallback(
    (f: number) => {
      if (!fadeEnabled) return baseVolume;

      // f is relative to this Sequence; convert to absolute timeline time
      const absoluteTime = bgmStart + f / fps;
      const fadeOutStart = totalDuration - fadeOutDuration;

      let multiplier = 1;
      if (fadeInDuration > 0 && absoluteTime < fadeInDuration) {
        multiplier = Math.min(
          multiplier,
          interpolate(absoluteTime, [0, fadeInDuration], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        );
      }
      if (fadeOutDuration > 0 && absoluteTime > fadeOutStart) {
        multiplier = Math.min(
          multiplier,
          interpolate(absoluteTime, [fadeOutStart, totalDuration], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        );
      }
      return baseVolume * multiplier;
    },
    [baseVolume, bgmStart, fps, fadeEnabled, fadeInDuration, fadeOutDuration, totalDuration],
  );

  const volumeProp = fadeEnabled ? getVolume : baseVolume;

  return (
    <Audio
      src={src}
      startFrom={startFromFrame}
      volume={volumeProp}
      pauseWhenBuffering
    />
  );
};
