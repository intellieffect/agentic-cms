'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { prefetch } from 'remotion';
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

export const RemotionPreview: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fontsLoaded = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // 미디어 로딩 상태 추적
  const [mediaLoading, setMediaLoading] = useState(true);
  const mediaLoadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (clips.length === 0) { setMediaLoading(false); return; }
    mediaLoadedRef.current.clear();
    setMediaLoading(true);

    const apiUrl = getEditorConfig().apiUrl;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl;
    const allSources = [...new Set(clips.map(c => c.source))];
    const bgmSources = bgmEnabled ? bgmClips.map(b => b.source) : [];
    const total = allSources.length + bgmSources.length;
    if (total === 0) { setMediaLoading(false); return; }

    let loaded = 0;
    const checkDone = () => { loaded++; if (loaded >= total) setMediaLoading(false); };

    for (const src of allSources) {
      fetch(`${base}/_proxy/${encodeURIComponent(src)}`, { method: 'HEAD' })
        .then(() => checkDone())
        .catch(() => checkDone());
    }
    for (const src of bgmSources) {
      fetch(`${base}/${encodeURIComponent(src)}`, { method: 'HEAD' })
        .then(() => checkDone())
        .catch(() => checkDone());
    }
  }, [clips, bgmClips, bgmEnabled]);

  // BGM + 영상 프리로드 — Remotion prefetch로 재생 딜레이 제거
  const prefetchFreeRef = useRef<(() => void)[]>([]);
  useEffect(() => {
    // 이전 prefetch 해제
    prefetchFreeRef.current.forEach((free) => free());
    prefetchFreeRef.current = [];

    const apiUrl = getEditorConfig().apiUrl;
    const base = typeof window !== 'undefined' ? `${window.location.origin}${apiUrl}` : apiUrl;

    // BGM 프리로드
    if (bgmEnabled && bgmClips.length) {
      for (const bgm of bgmClips) {
        try {
          const url = `${base}/${bgm.source}`;
          const { free } = prefetch(url, { method: 'blob-url', contentType: 'audio/mpeg' });
          prefetchFreeRef.current.push(free);
        } catch { /* ignore prefetch errors */ }
      }
    }

    // 영상 클립 프리로드 (처음 3개만)
    for (const clip of clips.slice(0, 3)) {
      const src = clip.source;
      if (!src) continue;
      try {
        const url = `${base}/${src}`;
        const { free } = prefetch(url, { method: 'blob-url', contentType: 'video/mp4' });
        prefetchFreeRef.current.push(free);
      } catch { /* ignore prefetch errors */ }
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
    mediaBasePath: (() => { const u = getEditorConfig().apiUrl; return typeof window !== 'undefined' ? `${window.location.origin}${u}` : u; })(),
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
