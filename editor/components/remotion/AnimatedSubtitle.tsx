import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

/** Default line-height string used by inner sub-components that don't receive it as a prop. */
const lineHeightStr = "140%";

export type SubtitleEffect = "typewriter" | "slideUp" | "fadeIn" | "none" | "wordHighlight" | "wordScale" | "wordBoxMove";

export interface SubtitleProps {
  text: string;
  effect: SubtitleEffect;
  style: {
    size?: number;
    color?: string;
    font?: string;
    x?: number;
    y?: number;
    bg?: boolean;
    bgColor?: string;
    bgAlpha?: number;
    lineHeight?: number;
    textAlign?: string;
    boxWidth?: number;
    highlightColor?: string;  // word highlight/scale/boxMove active color
  };
  durationInFrames: number;
}

// ─── Word-level animation helpers ───

function splitWords(text: string): string[] {
  return text.replace(/\\n/g, "\n").split(/(\s+)/).filter(Boolean);
}

function getActiveWordIndex(words: string[], frame: number, durationInFrames: number): number {
  // Evenly distribute words across the duration (excluding spaces)
  const realWords = words.filter(w => w.trim().length > 0);
  if (realWords.length === 0) return -1;
  const framesPerWord = durationInFrames / realWords.length;
  const realIdx = Math.min(Math.floor(frame / framesPerWord), realWords.length - 1);
  // Map back to words array index (including spaces)
  let count = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].trim().length > 0) {
      if (count === realIdx) return i;
      count++;
    }
  }
  return -1;
}

// ─── Word Highlight: active word changes color ───

const WordHighlightRenderer: React.FC<{
  words: string[];
  activeIdx: number;
  fontSize: number;
  color: string;
  highlightColor: string;
  fontFamily: string;
  textAlign: React.CSSProperties["textAlign"];
  bgRgba: string;
  padding: string;
  borderRadius: string;
  scale: number;
  showBg: boolean;
  frameW: number;
  boxWidth?: number;
}> = ({ words, activeIdx, fontSize, color, highlightColor, fontFamily, textAlign, bgRgba, padding, borderRadius, scale, showBg, frameW, boxWidth }) => {
  return (
    <span
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        lineHeight: lineHeightStr,
        textAlign,
        whiteSpace: "pre",
        backgroundColor: bgRgba,
        padding,
        borderRadius,
        display: "inline-block",
        ...(boxWidth && boxWidth > 0
          ? { width: `${(boxWidth / 100) * frameW}px`, wordBreak: "break-word" as const }
          : {}),
      }}
    >
      {words.map((word, i) => {
        const isActive = i === activeIdx;
        // No CSS transition — Remotion renders frames independently;
        // transitions are non-deterministic and would flicker in render.
        return (
          <span
            key={i}
            style={{
              color: isActive ? highlightColor : color,
              fontWeight: isActive ? 800 : "inherit",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

// ─── Word Scale: active word scales up ───

const WordScaleRenderer: React.FC<{
  words: string[];
  activeIdx: number;
  fontSize: number;
  color: string;
  highlightColor: string;
  fontFamily: string;
  textAlign: React.CSSProperties["textAlign"];
  bgRgba: string;
  padding: string;
  borderRadius: string;
  scale: number;
  showBg: boolean;
  frameW: number;
  boxWidth?: number;
  frame: number;
  fps: number;
}> = ({ words, activeIdx, fontSize, color, highlightColor, fontFamily, textAlign, bgRgba, padding, borderRadius, scale, showBg, frameW, boxWidth, frame, fps }) => {
  return (
    <span
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        lineHeight: lineHeightStr,
        textAlign,
        whiteSpace: "pre",
        backgroundColor: bgRgba,
        padding,
        borderRadius,
        display: "inline-block",
        ...(boxWidth && boxWidth > 0
          ? { width: `${(boxWidth / 100) * frameW}px`, wordBreak: "break-word" as const }
          : {}),
      }}
    >
      {words.map((word, i) => {
        const isActive = i === activeIdx;
        const scaleVal = isActive
          ? spring({ frame, fps, config: { damping: 15, stiffness: 200 }, durationInFrames: 8 }) * 0.25 + 1
          : 1;
        return (
          <span
            key={i}
            style={{
              color: isActive ? highlightColor : color,
              display: "inline-block",
              transform: `scale(${scaleVal})`,
              transformOrigin: "center bottom",
              fontWeight: isActive ? 800 : "inherit",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

// ─── Word Box Move: animated rounded rect behind active word ───

const WordBoxMoveRenderer: React.FC<{
  words: string[];
  activeIdx: number;
  fontSize: number;
  color: string;
  highlightColor: string;
  fontFamily: string;
  textAlign: React.CSSProperties["textAlign"];
  scale: number;
  frameW: number;
  boxWidth?: number;
  frame: number;
  fps: number;
}> = ({ words, activeIdx, fontSize, color, highlightColor, fontFamily, textAlign, scale, frameW, boxWidth, frame, fps }) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const wordRefs = React.useRef<(HTMLSpanElement | null)[]>([]);

  // Measure active word position. Use useLayoutEffect so measurement completes
  // before browser paints — required for Remotion render: each frame must paint
  // with the correct box position, never with a one-frame stale value.
  const [boxStyle, setBoxStyle] = React.useState<React.CSSProperties>({});

  React.useLayoutEffect(() => {
    const activeEl = wordRefs.current[activeIdx];
    const container = containerRef.current;
    if (!activeEl || !container) return;
    const cRect = container.getBoundingClientRect();
    const wRect = activeEl.getBoundingClientRect();
    setBoxStyle({
      left: wRect.left - cRect.left - 4 * scale,
      top: wRect.top - cRect.top - 2 * scale,
      width: wRect.width + 8 * scale,
      height: wRect.height + 4 * scale,
    });
  }, [activeIdx, scale]);

  // Smooth box arrival is driven by Remotion's frame, not CSS transition (which is
  // non-deterministic across render workers). Spring scales the box on word change.
  const framesPerWord = activeIdx >= 0 ? 1 : 0; // sentinel
  const localFrame = framesPerWord > 0 ? frame % Math.max(1, Math.round(fps * 0.4)) : 0;
  const arriveScale = activeIdx >= 0
    ? interpolate(localFrame, [0, 4], [0.94, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  return (
    <span
      ref={containerRef}
      style={{
        fontSize: `${fontSize}px`,
        fontFamily,
        lineHeight: lineHeightStr,
        textAlign,
        whiteSpace: "pre",
        display: "inline-block",
        position: "relative",
        ...(boxWidth && boxWidth > 0
          ? { width: `${(boxWidth / 100) * frameW}px`, wordBreak: "break-word" as const }
          : {}),
      }}
    >
      {/* Box snaps to active-word position each frame (deterministic);
          subtle pop-in via interpolate keeps it lively without CSS transition. */}
      <span
        style={{
          position: "absolute",
          backgroundColor: highlightColor,
          borderRadius: `${6 * scale}px`,
          transform: `scale(${arriveScale})`,
          transformOrigin: "center center",
          zIndex: 0,
          ...boxStyle,
        }}
      />
      {/* Words */}
      {words.map((word, i) => {
        const isActive = i === activeIdx;
        return (
          <span
            key={i}
            ref={(el) => { wordRefs.current[i] = el; }}
            style={{
              color: isActive ? "#000000" : color,
              position: "relative",
              zIndex: 1,
              fontWeight: isActive ? 800 : "inherit",
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};

// ─── Main Component ───

export const AnimatedSubtitle: React.FC<SubtitleProps> = ({
  text,
  effect,
  style,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { width: frameW, height: frameH, fps } = useVideoConfig();

  const baselineW = 432;
  const scale = frameW / baselineW;

  const rawSize = style.size ?? 16;
  const fontSize = rawSize * scale;
  const color = style.color ?? "#FFFFFF";
  const fontFamily = style.font ?? "'BMDOHYEON', sans-serif";
  const posX = style.x ?? 50;
  const posY = style.y ?? 80;
  const showBg = style.bg !== false;
  const bgColor = style.bgColor ?? "#000000";
  const bgAlpha = style.bgAlpha ?? 0.6;
  const userLineHeight = style.lineHeight ?? 1.4;
  const lineHeightStr = `${Math.round(userLineHeight * 100)}%`;
  const textAlign = (style.textAlign ?? "center") as React.CSSProperties["textAlign"];
  const highlightColor = style.highlightColor ?? "#FFD700";

  // ─── Word-level effects ───
  const isWordEffect = effect === "wordHighlight" || effect === "wordScale" || effect === "wordBoxMove";

  if (isWordEffect) {
    const words = splitWords(text);
    const activeIdx = getActiveWordIndex(words, frame, durationInFrames);

    // Fade in/out for word effects
    const fadeFrames = 10;
    let opacity = 1;
    opacity = interpolate(frame, [0, fadeFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    if (frame > durationInFrames - fadeFrames) {
      opacity = interpolate(frame, [durationInFrames - fadeFrames, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }

    const bgRgba = showBg && effect !== "wordBoxMove"
      ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
      : "transparent";
    const padding = showBg && effect !== "wordBoxMove" ? `${10 * scale}px ${14 * scale}px ${8 * scale}px` : `${4 * scale}px`;
    const borderRadius = showBg && effect !== "wordBoxMove" ? `${4 * scale}px` : "0";

    const commonProps = {
      words, activeIdx, fontSize, color, highlightColor, fontFamily, textAlign,
      bgRgba, padding, borderRadius, scale, showBg, frameW, boxWidth: style.boxWidth,
    };

    const pxX = (posX / 100) * frameW;
    const pxY = (posY / 100) * frameH;

    return (
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${pxX}px, ${pxY}px) translate(-50%, -50%)`,
        opacity,
        zIndex: 100,
        whiteSpace: "pre",
      }}>
        {effect === "wordHighlight" && <WordHighlightRenderer {...commonProps} />}
        {effect === "wordScale" && <WordScaleRenderer {...commonProps} frame={frame} fps={fps} />}
        {effect === "wordBoxMove" && (
          <WordBoxMoveRenderer
            words={words} activeIdx={activeIdx} fontSize={fontSize} color={color}
            highlightColor={highlightColor} fontFamily={fontFamily} textAlign={textAlign}
            scale={scale} frameW={frameW} boxWidth={style.boxWidth} frame={frame} fps={fps}
          />
        )}
      </div>
    );
  }

  // ─── Classic effects ───
  let displayText = text.replace(/\\n/g, "\n");
  let animOpacity = 1;
  let translateY = 0;

  switch (effect) {
    case "typewriter": {
      const revealFrames = Math.floor(durationInFrames * 0.6);
      const charsToShow = Math.floor(
        interpolate(frame, [0, revealFrames], [0, displayText.length], { extrapolateRight: "clamp" })
      );
      displayText = displayText.slice(0, charsToShow);
      break;
    }
    case "slideUp": {
      const enterFrames = 10;
      const exitStart = durationInFrames - 10;
      translateY = interpolate(frame, [0, enterFrames], [60, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      if (frame > exitStart) {
        translateY = interpolate(frame, [exitStart, durationInFrames], [0, 60], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      }
      animOpacity = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      if (frame > exitStart) {
        animOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      }
      break;
    }
    case "fadeIn": {
      const fadeInFrames = 4; // ~0.13s — very fast fade in
      const fadeOutFrames = 6;
      animOpacity = interpolate(frame, [0, fadeInFrames], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      if (frame > durationInFrames - fadeOutFrames) {
        animOpacity = interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      }
      break;
    }
    case "none":
    default:
      break;
  }

  const bgRgba = showBg
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
    : "transparent";
  const padding = showBg ? `${10 * scale}px ${14 * scale}px ${8 * scale}px` : "0";
  const borderRadius = showBg ? `${4 * scale}px` : "0";

    // Position using pixel offsets to avoid right-edge text wrapping
  const pixelX = (posX / 100) * frameW;
  const pixelY = (posY / 100) * frameH;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${pixelX}px, ${pixelY}px) translate(-50%, -50%) translateY(${translateY * scale}px)`,
        opacity: animOpacity,
        zIndex: 100,
        whiteSpace: "pre",
      }}
    >
      <span
        style={{
          fontSize: `${fontSize}px`,
          color,
          fontFamily,
          lineHeight: lineHeightStr,
          textAlign,
          whiteSpace: style.boxWidth && style.boxWidth > 0 ? "pre-wrap" : "pre",
          backgroundColor: bgRgba,
          padding,
          borderRadius,
          display: "inline-block",
          ...(style.boxWidth && style.boxWidth > 0
            ? { width: `${(style.boxWidth / 100) * frameW}px`, wordBreak: "break-word" as const }
            : {}),
        }}
      >
        {displayText}
      </span>
    </div>
  );
};
