'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef, type CallbackListener } from '@remotion/player';
import { VideoProject } from '../remotion/VideoProject';
import { registerFonts } from '../remotion/fonts';
import { useEditorStore } from './store';
import { CanvasOverlay } from './CanvasOverlay';

const FPS = 30;

// Video error suppression is handled globally by ErrorSuppressor component

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VideoProjectComponent = VideoProject as React.ComponentType<any>;

// ─── Inner Player — isolated from frequently-changing UI state ───
// Per Remotion best-practice: keep <Player> in its own component, sibling to controls/overlays
// that subscribe to currentTime, so frame updates don't re-render the Player.

type InnerPlayerProps = {
  playerRef: React.RefObject<PlayerRef | null>;
  fontsLoaded: React.MutableRefObject<boolean>;
};

const PlayerOnly: React.FC<InnerPlayerProps> = ({ playerRef, fontsLoaded }) => {
  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const clipCrops = useEditorStore((s) => s.clipCrops);
  const clipZooms = useEditorStore((s) => s.clipZooms);
  const clipSubStyles = useEditorStore((s) => s.clipSubStyles);
  const transitions = useEditorStore((s) => s.transitions);
  const globalSubs = useEditorStore((s) => s.globalSubs);
  const bgmClips = useEditorStore((s) => s.bgmClips);
  const globalEffects = useEditorStore((s) => s.globalEffects);
  const fadeInOut = useEditorStore((s) => s.fadeInOut);
  const subsEnabled = useEditorStore((s) => s.subsEnabled);
  const bgmEnabled = useEditorStore((s) => s.bgmEnabled);
  const orientation = useEditorStore((s) => s.orientation);
  const totalDuration = useEditorStore((s) => s.totalDuration);
  const sources = useEditorStore((s) => s.sources);

  // Load fonts once
  useEffect(() => {
    if (!fontsLoaded.current) {
      registerFonts();
      fontsLoaded.current = true;
    }
  }, [fontsLoaded]);

  // BGM + 영상 프리로드 — Remotion prefetch 사용
  // 의존성을 BGM source list / 첫 3개 video source로 한정 (clipMeta 등 변경엔 영향 X)
  const bgmSources = useMemo(
    () => bgmEnabled ? bgmClips.map((b) => b.source) : [],
    [bgmEnabled, bgmClips],
  );
  const headVideoSources = useMemo(
    () => clips.slice(0, 3).map((c) => c.source).filter(Boolean),
    [clips],
  );

  // Note: Remotion `prefetch()` was removed here. In dev with missing/in-progress media
  // proxies it 404s, and Remotion's internal HTTP rejection surfaces as an "unhandled
  // rejection" in Next.js's dev overlay even when wrapped in waitUntilDone().catch(...)
  // (the rejection fires through a path the user-attached handler doesn't intercept reliably).
  // The Player loads media on demand via <OffthreadVideo>/<Video> — prefetch was a perf
  // micro-opt for first-play snappiness, not a correctness requirement. Drop it.
  // Reference unused memos so they aren't flagged dead while we keep the source-list
  // computations available for future re-introduction.
  void bgmSources;
  void headVideoSources;

  // Memoize inputProps — 공식문서 권장: 미메모이제이션 시 트리 전체 재렌더 병목
  const inputProps = useMemo(
    () => ({
      clips,
      clipMeta,
      clipCrops,
      clipZooms,
      clipSubStyles,
      transitions,
      subs: [] as unknown[],
      globalSubs: subsEnabled ? globalSubs : [],
      bgmClips: bgmEnabled ? bgmClips : [],
      totalDuration,
      sources,
      globalEffects,
      fadeInOut,
      mediaBasePath: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100',
    }),
    [
      clips,
      clipMeta,
      clipCrops,
      clipZooms,
      clipSubStyles,
      transitions,
      subsEnabled,
      globalSubs,
      bgmEnabled,
      bgmClips,
      totalDuration,
      sources,
      globalEffects,
      fadeInOut,
    ],
  );

  const durationInFrames = Math.max(1, Math.ceil(totalDuration * FPS));

  const compositionWidth = orientation === 'square' ? 540 : orientation === 'horizontal' ? 960 : 540;
  const compositionHeight = orientation === 'square' ? 540 : orientation === 'horizontal' ? 540 : 960;

  return (
    <Player
      ref={playerRef}
      component={VideoProjectComponent}
      inputProps={inputProps}
      durationInFrames={durationInFrames}
      fps={FPS}
      compositionWidth={compositionWidth}
      compositionHeight={compositionHeight}
      style={{
        width: '100%',
        height: '100%',
      }}
      controls
      clickToPlay
      showVolumeControls
      autoPlay={false}
      loop
      overflowVisible={false}
      numberOfSharedAudioTags={8}
      errorFallback={({ error }: { error: Error }) => {
        // Surface the actual error to the dev console (no silent swallow);
        // global ErrorSuppressor still hides the noisy media-decode messages from the user.
        console.debug('[Player errorFallback]', error.message);
        return (
          <div style={{ color: '#666', fontSize: 11, padding: 20, textAlign: 'center' }}>
            영상 로딩 중... 재생 버튼을 눌러주세요
          </div>
        );
      }}
    />
  );
};

export const RemotionPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fontsLoaded = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const clipsLength = useEditorStore((s) => s.clips.length);
  const orientation = useEditorStore((s) => s.orientation);
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);

  // Sync player frame → store via Remotion's throttled `timeupdate` event
  // (replaces 60fps RAF polling — 공식 docs: timeupdate fires at most every 250ms)
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onTime: CallbackListener<'timeupdate'> = (e) => {
      setCurrentFrame(e.detail.frame);
    };
    const onSeeked: CallbackListener<'seeked'> = (e) => {
      setCurrentFrame(e.detail.frame);
    };
    const onPlay: CallbackListener<'play'> = () => setIsPlaying(true);
    const onPause: CallbackListener<'pause'> = () => setIsPlaying(false);
    const onEnded: CallbackListener<'ended'> = () => setIsPlaying(false);

    player.addEventListener('timeupdate', onTime);
    player.addEventListener('seeked', onSeeked);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);

    return () => {
      player.removeEventListener('timeupdate', onTime);
      player.removeEventListener('seeked', onSeeked);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
    };
  // playerRef.current is stable across mounts; clipsLength toggles between empty/non-empty UI
  // which conditionally mounts <PlayerOnly>, so re-attaching listeners on that flip is correct.
  }, [setCurrentFrame, setIsPlaying, clipsLength]);

  const seekTo = useCallback((frame: number) => {
    playerRef.current?.seekTo(frame);
  }, []);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isPlaying()) p.pause();
    else p.play();
  }, []);

  // Expose player controls for keyboard shortcuts
  useEffect(() => {
    const win = window as unknown as Record<string, unknown>;
    win.__studioSeekTo = seekTo;
    win.__studioPlayerRef = { toggle, seekTo };
    return () => {
      delete win.__studioSeekTo;
      delete win.__studioPlayerRef;
    };
  }, [seekTo, toggle]);

  // Fullscreen toggle (Feature 8)
  const toggleFullscreen = useCallback(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const handler = () => toggleFullscreen();
    window.addEventListener('studio-fullscreen-toggle', handler);
    return () => window.removeEventListener('studio-fullscreen-toggle', handler);
  }, [toggleFullscreen]);

  if (clipsLength === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
        fontSize: 14,
      }}>
        프로젝트를 로드하세요
      </div>
    );
  }

  const aspectRatio = orientation === 'square' ? '1/1' : orientation === 'horizontal' ? '16/9' : '9/16';

  return (
    <div
      ref={previewContainerRef}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative', width: '100%', maxHeight: '100%', aspectRatio }}>
        <PlayerOnly playerRef={playerRef} fontsLoaded={fontsLoaded} />
        <CanvasOverlay />
      </div>
      {/* Fullscreen button */}
      <button
        onClick={toggleFullscreen}
        title="전체화면 (F)"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff',
          borderRadius: 4,
          width: 28,
          height: 28,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          zIndex: 20,
        }}
      >
        {isFullscreen ? '⊡' : '⊞'}
      </button>
    </div>
  );
};
