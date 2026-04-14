import { useRef, useCallback, useState, useEffect } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from '../store';
import type { ClipAudioInfo } from './constants';

// 동시 실행 제한 큐 — 최대 concurrency개까지만 병렬 처리
async function processQueue(tasks: (() => Promise<void>)[], concurrency: number) {
  const executing: Promise<void>[] = [];
  for (const task of tasks) {
    const p = task().then(() => { executing.splice(executing.indexOf(p), 1); });
    executing.push(p);
    if (executing.length >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
}

export function useWaveform() {
  const clips = useEditorStore((s) => s.clips);
  const bgmClips = useEditorStore((s) => s.bgmClips);

  const bgmWaveforms = useRef<Map<string, Float32Array>>(new Map());
  const bgmWaveformDurations = useRef<Map<string, number>>(new Map());
  const clipWaveforms = useRef<Map<string, Float32Array>>(new Map());
  const [clipAudioInfo, setClipAudioInfo] = useState<Record<string, ClipAudioInfo>>({});
  const [waveformVersion, setWaveformVersion] = useState(0);

  const buildMediaUrl = useCallback((source: string) => {
    const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(source);
    if (isAudio) {
      return `${getEditorConfig().apiUrl}/${encodeURIComponent(source)}`;
    }
    const prefix = getEditorConfig().mediaProxyPrefix || '/_proxy';
    return `${getEditorConfig().apiUrl}${prefix}/${encodeURIComponent(source)}`;
  }, []);

  const extractWaveform = useCallback(async (source: string) => {
    const url = buildMediaUrl(source);
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buf = await response.arrayBuffer();
      const audioCtx = new AudioContext();
      try {
        const decoded = await audioCtx.decodeAudioData(buf);
        const data = decoded.getChannelData(0);
        const targetLen = Math.min(16000, data.length);
        const windowSize = Math.max(1, Math.floor(data.length / targetLen));
        const result = new Float32Array(targetLen);
        for (let i = 0; i < targetLen; i++) {
          const start = i * windowSize;
          const end = Math.min(start + windowSize, data.length);
          let peak = 0;
          for (let j = start; j < end; j++) {
            const abs = Math.abs(data[j]);
            if (abs > peak) peak = abs;
          }
          result[i] = peak;
        }
        const audioDuration = decoded.duration;
        return { peaks: result, duration: audioDuration };
      } finally {
        void audioCtx.close();
      }
    } catch {
      return null;
    }
  }, [buildMediaUrl]);

  const drawWaveformBars = useCallback((ctx: CanvasRenderingContext2D, widthPx: number, h: number, waveData: Float32Array | undefined, color: string, fallbackColor: string) => {
    if (!waveData || waveData.length === 0) {
      ctx.strokeStyle = fallbackColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < widthPx; x += 3) {
        const y = h / 2 + Math.sin(x * 0.15) * (h * 0.22);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    const mid = h / 2;
    const baseAlpha = 0.7;
    for (let x = 0; x < widthPx; x++) {
      const sampleIdx = Math.floor(x * waveData.length / widthPx);
      const sampleEnd = Math.min(Math.floor((x + 1) * waveData.length / widthPx), waveData.length);
      let peak = 0;
      let rms = 0;
      let count = 0;
      for (let j = sampleIdx; j < sampleEnd; j++) {
        const v = Math.abs(waveData[j]);
        if (v > peak) peak = v;
        rms += v * v;
        count++;
      }
      rms = count > 0 ? Math.sqrt(rms / count) : 0;
      const peakH = Math.max(1, peak * (h - 2));
      ctx.fillStyle = color;
      ctx.fillRect(x, mid - peakH / 2, 1, peakH);
      const rmsH = Math.max(1, rms * (h - 2));
      ctx.fillStyle = color.replace(/[\d.]+\)$/, `${baseAlpha})`);
      ctx.fillRect(x, mid - rmsH / 2, 1, rmsH);
    }
  }, []);

  const drawBgmWaveform = useCallback((canvas: HTMLCanvasElement | null, bgmSource: string, widthPx: number, audioStart?: number, duration?: number, totalDuration?: number) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const h = canvas.height;
    ctx.clearRect(0, 0, widthPx, h);
    let waveData = bgmWaveforms.current.get(bgmSource);
    const audioDur = totalDuration || bgmWaveformDurations.current.get(bgmSource) || 0;
    if (waveData && waveData.length > 0 && audioDur > 0 && audioStart != null && duration != null && duration < audioDur - 0.01) {
      const startRatio = audioStart / audioDur;
      const endRatio = Math.min((audioStart + duration) / audioDur, 1);
      const startIdx = Math.floor(startRatio * waveData.length);
      const endIdx = Math.min(Math.ceil(endRatio * waveData.length), waveData.length);
      if (endIdx > startIdx) {
        waveData = waveData.slice(startIdx, endIdx);
      }
    }
    drawWaveformBars(ctx, widthPx, h, waveData, '#10b98166', '#10b98144');
  }, [drawWaveformBars]);

  const drawClipWaveform = useCallback((canvas: HTMLCanvasElement | null, clipSource: string, widthPx: number, muted: boolean) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const h = canvas.height;
    ctx.clearRect(0, 0, widthPx, h);
    drawWaveformBars(
      ctx,
      widthPx,
      h,
      clipWaveforms.current.get(clipSource),
      muted ? 'rgba(239,68,68,0.28)' : 'rgba(96,165,250,0.45)',
      muted ? 'rgba(239,68,68,0.22)' : 'rgba(96,165,250,0.22)',
    );
  }, [drawWaveformBars]);

  // Load waveform data for BGM clips (최대 2개 동시)
  useEffect(() => {
    let cancelled = false;
    const tasks = bgmClips
      .filter((bgm) => !bgmWaveforms.current.has(bgm.source))
      .map((bgm) => () =>
        extractWaveform(bgm.source).then((result) => {
          if (cancelled) return;
          if (result) {
            bgmWaveforms.current.set(bgm.source, result.peaks);
            bgmWaveformDurations.current.set(bgm.source, result.duration);
            setWaveformVersion((v) => v + 1);
          }
        }).catch(() => { /* ignore */ })
      );
    if (tasks.length > 0) processQueue(tasks, 2);
    return () => { cancelled = true; };
  }, [bgmClips, extractWaveform]);

  // Load waveform data for clip audio (최대 2개 동시)
  useEffect(() => {
    let cancelled = false;
    const tasks = clips
      .filter((clip) => !clipAudioInfo[clip.source])
      .map((clip) => () =>
        fetch(`${getEditorConfig().apiUrl}/api/media/probe/${encodeURIComponent(clip.source)}`)
          .then((r) => r.ok ? r.json() : null)
          .then((info) => {
            if (cancelled || !info) return;
            setClipAudioInfo((prev) => prev[clip.source] ? prev : { ...prev, [clip.source]: { hasAudio: info.hasAudio !== false } });
            if (info.hasAudio === false || clipWaveforms.current.has(clip.source)) return;
            return extractWaveform(clip.source).then((result) => {
              if (cancelled) return;
              if (result) {
                clipWaveforms.current.set(clip.source, result.peaks);
                setWaveformVersion((v) => v + 1);
              }
            });
          })
          .catch(() => {
            if (cancelled) return;
            setClipAudioInfo((prev) => prev[clip.source] ? prev : { ...prev, [clip.source]: { hasAudio: true } });
          })
      );
    if (tasks.length > 0) processQueue(tasks, 2);
    return () => { cancelled = true; };
  }, [clips, clipAudioInfo, extractWaveform]);

  return {
    bgmWaveformDurations,
    clipAudioInfo,
    waveformVersion,
    drawBgmWaveform,
    drawClipWaveform,
  };
}
