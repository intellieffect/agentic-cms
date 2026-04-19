import React from "react";
import {
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  AbsoluteFill,
} from "remotion";

import { VideoClip } from "./VideoClip";
import { AnimatedSubtitle, type SubtitleEffect } from "./AnimatedSubtitle";
import { BgmAudio, type BgmClipData } from "./BgmAudio";

// ─── Types matching brxce-editor project JSON ───

interface Clip {
  source: string;
  start: number;
  end: number;
  source_idx: number;
  track?: number;
  timelineStart?: number;
}

interface ClipMeta {
  speed: number;
  opacity?: number;
  rotation?: number;
  volume?: number;    // 0-100, default 100
  audioMuted?: boolean;
  fitMode?: 'cover' | 'contain';
  positionX?: number; // 0-100, default 50
  positionY?: number; // 0-100, default 50
}

interface FadeInOut {
  enabled: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

interface ClipCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ClipZoom {
  scale: number;
  panX: number;
  panY: number;
  animation?: 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'custom';
  scaleEnd?: number;
  panXEnd?: number;
  panYEnd?: number;
}

interface ClipSubStyle {
  size: number;
  x: number;
  y: number;
  font: string;
}

interface Transition {
  type: string;
  duration: number;
}

interface GlobalSub {
  text: string;
  start: number;
  end: number;
  style: { size?: number; x?: number; y?: number; color?: string; font?: string };
  effect?: SubtitleEffect;
}

interface GlobalEffect {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale' | 'sepia' | 'hueRotate';
  value: number;
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
  bgmClips: BgmClipData[];
  totalDuration: number;
  sources: string[];
  mediaBasePath?: string;
  fps?: number;
  globalEffects?: GlobalEffect[];
  fadeInOut?: FadeInOut;
}

// ─── Lightweight transition overlay (preview-friendly, no dual-video decode) ───

const TransitionOverlay: React.FC<{
  type: string;
  durationInFrames: number;
}> = ({ type, durationInFrames }) => {
  const frame = useCurrentFrame();
  if (type === "none" || durationInFrames <= 0) return null;

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Fade: black overlay fades in then out
  if (type === "fade" || type === "fadeblack") {
    const opacity = progress < 0.5
      ? interpolate(progress, [0, 0.5], [0, 1])
      : interpolate(progress, [0.5, 1], [1, 0]);
    return <AbsoluteFill style={{ backgroundColor: "black", opacity, zIndex: 50 }} />;
  }
  if (type === "fadewhite") {
    const opacity = progress < 0.5
      ? interpolate(progress, [0, 0.5], [0, 1])
      : interpolate(progress, [0.5, 1], [1, 0]);
    return <AbsoluteFill style={{ backgroundColor: "white", opacity, zIndex: 50 }} />;
  }

  // Wipe: black bar sweeps across
  if (type.startsWith("wipe")) {
    const p = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    const clipPath = type === "wipeleft" ? `inset(0 ${(1-p)*100}% 0 0)`
      : type === "wiperight" ? `inset(0 0 0 ${(1-p)*100}%)`
      : type === "wipeup" ? `inset(0 0 ${(1-p)*100}% 0)`
      : `inset(${(1-p)*100}% 0 0 0)`;
    return <AbsoluteFill style={{ backgroundColor: "black", clipPath, zIndex: 50 }} />;
  }

  // Slide/Cube: simple crossfade fallback for preview (actual effect in render)
  const opacity = progress < 0.5
    ? interpolate(progress, [0, 0.5], [0, 0.7])
    : interpolate(progress, [0.5, 1], [0.7, 0]);
  return <AbsoluteFill style={{ backgroundColor: "black", opacity, zIndex: 50 }} />;
};

// ─── Main Composition ───

export const VideoProject: React.FC<ProjectData> = (props) => {
  let fps = 30;
  try {
    const config = useVideoConfig();
    fps = config.fps;
  } catch {
    fps = props.fps ?? 30;
  }
  const {
    clips,
    clipMeta,
    clipCrops,
    clipZooms,
    transitions,
    globalSubs,
    bgmClips,
    mediaBasePath = "",
    globalEffects,
    fadeInOut,
  } = props;

  const frame = useCurrentFrame();

  // Build CSS filter string from globalEffects — applied directly to each <OffthreadVideo>
  const getEffectVal = (type: string, defaultVal: number = 100) => {
    const ef = (globalEffects || []).find((e) => e.type === type);
    return ef?.value ?? defaultVal;
  };
  const brightness = getEffectVal("brightness", 100);
  const contrast = getEffectVal("contrast", 100);
  const saturation = getEffectVal("saturation", 100);
  const blur = getEffectVal("blur", 0);
  const grayscale = getEffectVal("grayscale", 0);
  const sepia = getEffectVal("sepia", 0);
  const hueRotate = getEffectVal("hueRotate", 0);

  const filterParts: string[] = [];
  if (brightness !== 100) filterParts.push(`brightness(${brightness / 100})`);
  if (contrast !== 100) filterParts.push(`contrast(${contrast / 100})`);
  if (saturation !== 100) filterParts.push(`saturate(${saturation / 100})`);
  if (blur > 0) filterParts.push(`blur(${blur}px)`);
  if (grayscale > 0) filterParts.push(`grayscale(${grayscale / 100})`);
  if (sepia > 0) filterParts.push(`sepia(${sepia / 100})`);
  if (hueRotate > 0) filterParts.push(`hue-rotate(${hueRotate}deg)`);

  const filterStr = filterParts.length > 0 ? filterParts.join(" ") : undefined;

  // Calculate clip durations
  const clipDurations: number[] = clips.map((clip, i) => {
    const speed = clipMeta[i]?.speed ?? 1;
    return (clip.end - clip.start) / speed;
  });

  // Legacy sequential positions (fallback)
  const transitionDurations: number[] = [];
  for (let i = 0; i < clips.length - 1; i++) {
    const t = transitions[i];
    if (t && t.type !== "none" && t.duration > 0) {
      transitionDurations.push(t.duration);
    } else {
      transitionDurations.push(0);
    }
  }

  const clipStarts: number[] = [0];
  for (let i = 1; i < clips.length; i++) {
    const prevEnd = clipStarts[i - 1] + clipDurations[i - 1];
    const overlap = transitionDurations[i - 1] ?? 0;
    clipStarts.push(prevEnd - overlap);
  }

  // Get effective timeline start for a clip
  const getClipTimelineStart = (i: number) => clips[i].timelineStart ?? clipStarts[i];

  // Fade in/out opacity
  const totalDurationFrames = Math.ceil(props.totalDuration * fps);
  let fadeOpacity = 1;
  if (fadeInOut?.enabled) {
    const fadeInFrames = Math.ceil(fadeInOut.fadeInDuration * fps);
    const fadeOutFrames = Math.ceil(fadeInOut.fadeOutDuration * fps);
    const fadeIn = fadeInFrames > 0
      ? interpolate(frame, [0, fadeInFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 1;
    const fadeOut = fadeOutFrames > 0
      ? interpolate(frame, [totalDurationFrames - fadeOutFrames, totalDurationFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : 1;
    fadeOpacity = Math.min(fadeIn, fadeOut);
  }

  // Group clips by track for multi-track rendering
  const NUM_TRACKS = 3;
  const trackClips: { clipIndex: number; clip: Clip }[][] = Array.from({ length: NUM_TRACKS }, () => []);
  clips.forEach((clip, i) => {
    const track = clip.track ?? 0;
    const clampedTrack = Math.max(0, Math.min(NUM_TRACKS - 1, track));
    trackClips[clampedTrack].push({ clipIndex: i, clip });
  });

  // For transition detection: find adjacent clips on same track
  const getTrackTransitions = (trackIdx: number) => {
    const tClips = trackClips[trackIdx];
    if (tClips.length < 2) return [];
    // Sort by timelineStart
    const sorted = [...tClips].sort((a, b) => getClipTimelineStart(a.clipIndex) - getClipTimelineStart(b.clipIndex));
    const result: { transIndex: number; startSec: number; durationSec: number; type: string }[] = [];
    for (let j = 0; j < sorted.length - 1; j++) {
      const aIdx = sorted[j].clipIndex;
      const bIdx = sorted[j + 1].clipIndex;
      const aEnd = getClipTimelineStart(aIdx) + clipDurations[aIdx];
      const bStart = getClipTimelineStart(bIdx);
      // 인접 판정: 차이 0.01초 이내
      if (Math.abs(aEnd - bStart) < 0.01) {
        const tIdx = Math.min(aIdx, bIdx);
        const t = transitions[tIdx];
        if (t && t.type !== "none" && t.duration > 0) {
          result.push({ transIndex: tIdx, startSec: aEnd - t.duration, durationSec: t.duration, type: t.type });
        }
      }
    }
    return result;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/* Video clips — multi-track: track 0(바닥) → track 2(최상단) */}
      <AbsoluteFill style={fadeOpacity < 1 ? { opacity: fadeOpacity } : undefined}>
        {Array.from({ length: NUM_TRACKS }, (_, trackIdx) => (
          <AbsoluteFill key={`track-${trackIdx}`}>
            {trackClips[trackIdx].map(({ clipIndex: i, clip }) => {
              const startFrame = Math.round(getClipTimelineStart(i) * fps);
              const durationFrames = Math.max(1, Math.ceil(clipDurations[i] * fps));

              return (
                <Sequence
                  key={`clip-${i}`}
                  from={startFrame}
                  durationInFrames={durationFrames}
                >
                  <VideoClip
                    source={clip.source}
                    start={clip.start}
                    end={clip.end}
                    speed={clipMeta[i]?.speed ?? 1}
                    crop={clipCrops[i] ?? { x: 0, y: 0, w: 100, h: 100 }}
                    zoom={clipZooms[i] ?? { scale: 1, panX: 0, panY: 0 }}
                    mediaBasePath={mediaBasePath}
                    filter={filterStr}
                    opacity={clipMeta[i]?.opacity}
                    rotation={clipMeta[i]?.rotation}
                    volume={clipMeta[i]?.volume}
                    audioMuted={clipMeta[i]?.audioMuted}
                    fitMode={clipMeta[i]?.fitMode}
                    positionX={clipMeta[i]?.positionX}
                    positionY={clipMeta[i]?.positionY}
                  />
                </Sequence>
              );
            })}
            {/* Transition overlays for this track */}
            {getTrackTransitions(trackIdx).map((tr) => {
              const startFrame = Math.round(tr.startSec * fps);
              const durationFrames = Math.max(1, Math.ceil(tr.durationSec * fps));
              return (
                <Sequence key={`trans-track${trackIdx}-${tr.transIndex}`} from={startFrame} durationInFrames={durationFrames}>
                  <TransitionOverlay type={tr.type} durationInFrames={durationFrames} />
                </Sequence>
              );
            })}
          </AbsoluteFill>
        ))}
      </AbsoluteFill>

      {/* Global subtitles — NOT affected by fadeInOut */}
      {globalSubs.map((sub, i) => {
        const startFrame = Math.round(sub.start * fps);
        const durationFrames = Math.max(1, Math.ceil((sub.end - sub.start) * fps));

        return (
          <Sequence
            key={`sub-${i}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <AbsoluteFill>
              <AnimatedSubtitle
                text={sub.text}
                effect={sub.effect ?? "fadeIn"}
                style={sub.style}
                durationInFrames={durationFrames}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* BGM audio tracks */}
      {bgmClips.map((bgm, i) => {
        const startFrame = Math.round(bgm.start * fps);
        const durationFrames = Math.max(1, Math.ceil(bgm.duration * fps));

        return (
          <Sequence
            key={`bgm-${i}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <BgmAudio
              bgmClip={bgm}
              fps={fps}
              mediaBasePath={mediaBasePath}
              fadeInOut={fadeInOut}
              totalDuration={props.totalDuration}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
