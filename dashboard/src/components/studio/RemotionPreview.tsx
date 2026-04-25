'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef, type CallbackListener } from '@remotion/player';
import { VideoProject } from '../remotion/VideoProject';
import { registerFonts } from '../remotion/fonts';
import { getEditorConfig } from '@/lib/editor-config';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from './store';
import { CanvasOverlay } from './CanvasOverlay';

const FPS = 30;

// Video error suppression is handled globally by ErrorSuppressor component

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VideoProjectComponent = VideoProject as React.ComponentType<any>;

// ─── Inner Player — isolated from frequently-changing UI state ───
// Per Remotion best-practice: keep <Player> in its own component sibling to
// controls/overlays that subscribe to currentTime, so frame updates don't
// re-render the Player tree.
//
// Note: Remotion `prefetch()` was intentionally removed. In dev with missing/in-progress
// media proxies it 404s, and Remotion's internal HTTP rejection surfaces as an
// "unhandled rejection" Runtime Error in Next.js's dev overlay even when wrapped in
// waitUntilDone().catch(...). The Player loads media on demand via <OffthreadVideo>/<Video> —
// prefetch was a perf micro-opt for first-play snappiness, not a correctness requirement.

type InnerPlayerProps = {
  playerRef: React.RefObject<PlayerRef | null>;
  fontsLoaded: React.MutableRefObject<boolean>;
};

const PlayerOnly: React.FC<InnerPlayerProps> = ({ playerRef, fontsLoaded }) => {
  const {
    clips, clipMeta, clipCrops, clipZooms, clipSubStyles,
    transitions, globalSubs, bgmClips, globalEffects, fadeInOut,
    subsEnabled, bgmEnabled, orientation, totalDuration, sources,
  } = useEditorStore(useShallow((s) => ({
    clips: s.clips,
    clipMeta: s.clipMeta,
    clipCrops: s.clipCrops,
    clipZooms: s.clipZooms,
    clipSubStyles: s.clipSubStyles,
    transitions: s.transitions,
    globalSubs: s.globalSubs,
    bgmClips: s.bgmClips,
    globalEffects: s.globalEffects,
    fadeInOut: s.fadeInOut,
    subsEnabled: s.subsEnabled,
    bgmEnabled: s.bgmEnabled,
    orientation: s.orientation,
    totalDuration: s.totalDuration,
    sources: s.sources,
  })));

  // Load fonts once
  useEffect(() => {
    if (!fontsLoaded.current) {
      registerFonts();
      fontsLoaded.current = true;
    }
  }, [fontsLoaded]);

  const mediaBasePath = useMemo(() => {
    const u = getEditorConfig().apiUrl;
    return typeof window !== 'undefined' ? `${window.location.origin}${u}` : u;
  }, []);

  // Memoize inputProps — 공식문서 권장: 미메모이제이션 시 Player 트리 전체 재렌더 병목
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
      mediaBasePath,
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
      mediaBasePath,
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
  // (replaces 60fps RAF polling — 공식 docs: timeupdate fires at most every 250ms).
  // Also handles play/pause/ended via events instead of setInterval ref-poll.
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

  // Expose player controls via zustand store
  useEffect(() => {
    useEditorStore.getState().setPlayerCallbacks(seekTo, toggle);
    return () => {
      useEditorStore.getState().clearPlayerCallbacks();
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

  // 미디어 로딩 인디케이터 — 프로젝트 로딩 후 첫 frame 준비될 때까지
  const [mediaLoading, setMediaLoading] = useState(true);
  useEffect(() => {
    if (clipsLength > 0) setMediaLoading(false);
  }, [clipsLength]);

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
      {mediaLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
        }}>
          <div style={{
            width: 32, height: 32, border: '3px solid #333', borderTop: '3px solid #60a5fa',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: '#888', fontSize: 11, marginTop: 10 }}>미디어 로딩 중...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
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
