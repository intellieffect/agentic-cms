import React, { useCallback } from "react";
import { Audio, useCurrentFrame, interpolate } from "remotion";

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
    : `http://localhost:8092/${bgmClip.source}`;

  const startFromFrame = Math.round(bgmClip.audioStart * fps);
  const baseVolume = bgmClip.volume / 100;
  const frame = useCurrentFrame();

  // Compute volume with fade in/out applied
  const getVolume = useCallback(
    (f: number) => {
      if (!fadeInOut?.enabled || totalDuration <= 0) return baseVolume;

      // f is relative to this Sequence; convert to absolute timeline time
      const absoluteTime = bgmClip.start + f / fps;
      const fadeInEnd = fadeInOut.fadeInDuration;
      const fadeOutStart = totalDuration - fadeInOut.fadeOutDuration;

      let multiplier = 1;
      if (fadeInOut.fadeInDuration > 0 && absoluteTime < fadeInEnd) {
        multiplier = Math.min(multiplier, interpolate(
          absoluteTime, [0, fadeInEnd], [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        ));
      }
      if (fadeInOut.fadeOutDuration > 0 && absoluteTime > fadeOutStart) {
        multiplier = Math.min(multiplier, interpolate(
          absoluteTime, [fadeOutStart, totalDuration], [1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        ));
      }
      return baseVolume * multiplier;
    },
    [baseVolume, bgmClip.start, fps, fadeInOut, totalDuration],
  );

  // If no fade, use static volume; otherwise use callback
  const volumeProp = (!fadeInOut?.enabled || totalDuration <= 0)
    ? baseVolume
    : getVolume;

  return (
    <Audio
      src={src}
      startFrom={startFromFrame}
      volume={volumeProp}
      pauseWhenBuffering
    />
  );
};
