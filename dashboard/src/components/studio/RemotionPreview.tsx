'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { prefetch } from 'remotion';
import { VideoProject } from '../remotion/VideoProject';
import { registerFonts } from '../remotion/fonts';
import { useEditorStore } from './store';
import { CanvasOverlay } from './CanvasOverlay';

const FPS = 30;

// Video error suppression is handled globally by ErrorSuppressor component

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VideoProjectComponent = VideoProject as React.ComponentType<any>;

export const RemotionPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fontsLoaded = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);

  // Load fonts once
  useEffect(() => {
    if (!fontsLoaded.current) {
      registerFonts();
      fontsLoaded.current = true;
    }
  }, []);

  // Sync player frame → store (poll via RAF)
  useEffect(() => {
    let rafId: number;
    let lastFrame = -1;

    const tick = () => {
      const player = playerRef.current;
      if (player) {
        try {
          const frame = player.getCurrentFrame();
          if (frame !== lastFrame) {
            lastFrame = frame;
            setCurrentFrame(frame);
          }
        } catch {
          // player not ready yet
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [setCurrentFrame]);

  // Play/pause events
  useEffect(() => {
    const check = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      clearInterval(check);
      const onPlay = () => setIsPlaying(true);
      const onPause = () => setIsPlaying(false);
      player.addEventListener('play', onPlay);
      player.addEventListener('pause', onPause);
    }, 200);
    return () => clearInterval(check);
  }, [setIsPlaying]);

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

  // Listen for fullscreen changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Listen for 'F' key from Timeline keyboard handler
  useEffect(() => {
    const handler = () => toggleFullscreen();
    window.addEventListener('studio-fullscreen-toggle', handler);
    return () => window.removeEventListener('studio-fullscreen-toggle', handler);
  }, [toggleFullscreen]);

  const durationInFrames = Math.max(1, Math.ceil(totalDuration * FPS));

  // BGM + 영상 프리로드 — Remotion prefetch로 재생 딜레이 제거
  const prefetchFreeRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    // 이전 prefetch 해제
    prefetchFreeRef.current.forEach((free) => free());
    prefetchFreeRef.current = [];

    const base = typeof window !== 'undefined' ? window.location.origin : '';

    // BGM 프리로드
    if (bgmEnabled && bgmClips.length) {
      for (const bgm of bgmClips) {
        const url = `${base}/${bgm.source}`;
        const { free } = prefetch(url, { method: 'blob-url', contentType: 'audio/mpeg' });
        prefetchFreeRef.current.push(free);
      }
    }

    // 영상 클립 프리로드 (처음 3개만)
    for (const clip of clips.slice(0, 3)) {
      const src = clip.source;
      if (!src) continue;
      const url = `${base}/${src}`;
      const { free } = prefetch(url, { method: 'blob-url', contentType: 'video/mp4' });
      prefetchFreeRef.current.push(free);
    }

    return () => {
      prefetchFreeRef.current.forEach((free) => free());
      prefetchFreeRef.current = [];
    };
  }, [bgmClips, bgmEnabled, clips]);

  const inputProps = {
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
  };

  if (clips.length === 0) {
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
      <div style={{ position: 'relative', width: '100%', maxHeight: '100%', aspectRatio: orientation === 'square' ? '1/1' : orientation === 'horizontal' ? '16/9' : '9/16' }}>
        <Player
          ref={playerRef}
          component={VideoProjectComponent}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={FPS}
          compositionWidth={orientation === 'square' ? 540 : orientation === 'horizontal' ? 960 : 540}
          compositionHeight={orientation === 'square' ? 540 : orientation === 'horizontal' ? 540 : 960}
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
          errorFallback={({ error }: { error: Error }) => (
            <div style={{ color: '#666', fontSize: 11, padding: 20, textAlign: 'center' }}>
              영상 로딩 중... 재생 버튼을 눌러주세요
            </div>
          )}
        />
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
