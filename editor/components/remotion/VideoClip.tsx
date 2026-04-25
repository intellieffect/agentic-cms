import React from "react";
import { OffthreadVideo, Video, useCurrentFrame, useVideoConfig, interpolate, getRemotionEnvironment } from "remotion";
import { getEditorConfig } from "@/editor.config";

export interface ClipZoomAnimated {
  scale: number;
  panX: number;
  panY: number;
  animation?: 'none' | 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'panUp' | 'panDown' | 'custom';
  scaleEnd?: number;
  panXEnd?: number;
  panYEnd?: number;
}

export interface ClipProps {
  source: string;
  start: number;
  end: number;
  speed: number;
  crop: { x: number; y: number; w: number; h: number };
  zoom: ClipZoomAnimated;
  mediaBasePath: string;
  filter?: string;
  opacity?: number;
  rotation?: number;
  volume?: number;    // 0-100, default 100
  audioMuted?: boolean;
  fitMode?: 'cover' | 'contain';
  positionX?: number; // 0-100, default 50 (objectPosition X)
  positionY?: number; // 0-100, default 50 (objectPosition Y)
}

// Resolve animated zoom start/end based on animation preset
function resolveZoomAnimation(zoom: ClipZoomAnimated): {
  scaleStart: number; scaleEnd: number;
  panXStart: number; panXEnd: number;
  panYStart: number; panYEnd: number;
} {
  const s = zoom.scale;
  const px = zoom.panX;
  const py = zoom.panY;

  switch (zoom.animation) {
    case 'zoomIn':
      return { scaleStart: s, scaleEnd: s * 1.3, panXStart: px, panXEnd: px, panYStart: py, panYEnd: py };
    case 'zoomOut':
      return { scaleStart: s * 1.3, scaleEnd: s, panXStart: px, panXEnd: px, panYStart: py, panYEnd: py };
    case 'panLeft':
      return { scaleStart: s, scaleEnd: s, panXStart: px + 10, panXEnd: px - 10, panYStart: py, panYEnd: py };
    case 'panRight':
      return { scaleStart: s, scaleEnd: s, panXStart: px - 10, panXEnd: px + 10, panYStart: py, panYEnd: py };
    case 'panUp':
      return { scaleStart: s, scaleEnd: s, panXStart: px, panXEnd: px, panYStart: py + 8, panYEnd: py - 8 };
    case 'panDown':
      return { scaleStart: s, scaleEnd: s, panXStart: px, panXEnd: px, panYStart: py - 8, panYEnd: py + 8 };
    case 'custom':
      return {
        scaleStart: s, scaleEnd: zoom.scaleEnd ?? s,
        panXStart: px, panXEnd: zoom.panXEnd ?? px,
        panYStart: py, panYEnd: zoom.panYEnd ?? py,
      };
    default: // 'none' or undefined
      return { scaleStart: s, scaleEnd: s, panXStart: px, panXEnd: px, panYStart: py, panYEnd: py };
  }
}

export const VideoClip: React.FC<ClipProps> = ({
  source,
  start,
  speed,
  crop,
  zoom,
  mediaBasePath,
  filter,
  opacity,
  rotation,
  volume,
  audioMuted,
  fitMode,
  positionX,
  positionY,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const startFromFrame = Math.round(start * fps);

  const src = mediaBasePath
    ? `${mediaBasePath}/${source}`
    : `${getEditorConfig().apiUrl}${getEditorConfig().mediaProxyPrefix}/${source}`;

  // Crop as clip-path (percentage-based)
  const clipPath =
    crop.w < 100 || crop.h < 100 || crop.x > 0 || crop.y > 0
      ? `inset(${crop.y}% ${100 - crop.x - crop.w}% ${100 - crop.y - crop.h}% ${crop.x}%)`
      : undefined;

  // Animated zoom: interpolate scale/panX/panY over clip duration
  const { scaleStart, scaleEnd, panXStart, panXEnd, panYStart, panYEnd } = resolveZoomAnimation(zoom);
  const hasAnimation = zoom.animation && zoom.animation !== 'none';

  const currentScale = hasAnimation
    ? interpolate(frame, [0, durationInFrames], [scaleStart, scaleEnd], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : zoom.scale;
  const currentPanX = hasAnimation
    ? interpolate(frame, [0, durationInFrames], [panXStart, panXEnd], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : zoom.panX;
  const currentPanY = hasAnimation
    ? interpolate(frame, [0, durationInFrames], [panYStart, panYEnd], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : zoom.panY;

  // Build transform
  const transformParts: string[] = [];
  if (currentScale !== 1 || currentPanX !== 0 || currentPanY !== 0) {
    transformParts.push(`scale(${currentScale.toFixed(3)}) translate(${currentPanX.toFixed(2)}%, ${currentPanY.toFixed(2)}%)`);
  }
  if (rotation && rotation !== 0) {
    transformParts.push(`rotate(${rotation}deg)`);
  }
  const transform = transformParts.length > 0 ? transformParts.join(' ') : undefined;

  const clipOpacity = opacity != null ? opacity / 100 : undefined;
  const clipVolume = volume != null ? volume / 100 : 1;
  const objectFit = fitMode === 'contain' ? 'contain' : 'cover';
  const objPosX = positionX ?? 50;
  const objPosY = positionY ?? 50;
  const objectPosition = (objPosX !== 50 || objPosY !== 50) ? `${objPosX}% ${objPosY}%` : undefined;

  // HEVC originals may fail in browser during proxy generation — log only, errorFallback renders placeholder
  const handleError = (err: Error) => {
    console.debug(`[VideoClip] ${source}: ${err.message}`);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        opacity: clipOpacity,
      }}
    >
      {getRemotionEnvironment().isRendering ? (
        <OffthreadVideo
          src={src}
          startFrom={startFromFrame}
          playbackRate={speed}
          volume={clipVolume}
          muted={audioMuted}
          onError={handleError}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            objectPosition,
            clipPath,
            transform,
            filter,
          }}
        />
      ) : (
        <Video
          src={src}
          startFrom={startFromFrame}
          playbackRate={speed}
          volume={clipVolume}
          muted={audioMuted}
          pauseWhenBuffering
          acceptableTimeShiftInSeconds={1}
          onError={handleError}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            objectPosition,
            clipPath,
            transform,
            filter,
          }}
        />
      )}
    </div>
  );
};
