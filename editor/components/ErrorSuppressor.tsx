'use client';

import { useEffect } from 'react';

/**
 * Suppress media-decode errors that happen *before* the server-side proxy is ready
 * (HEVC originals served briefly while the H.264 proxy is still encoding).
 *
 * Best-practice notes:
 * - Remotion's <Player errorFallback> + <Video onError> are the primary handlers
 *   for in-tree errors. This suppressor only catches the *adjacent* noise that
 *   browsers / Next.js dev overlay emit at the window/console level when an
 *   <video> element rejects a codec.
 * - We narrow by pattern to a small allowlist and skip suppression entirely when
 *   NEXT_PUBLIC_DEBUG_VIDEO_ERRORS is set, so a developer can always opt back in.
 * - Mount once in LayoutShell to cover all editor pages.
 */

// Narrow allowlist of media-error message fragments. Adding here is intentional —
// don't widen casually, or real errors get masked.
const MEDIA_ERROR_PATTERNS = [
  'Error occurred in video',
  'The browser threw an error while playing the video',
  'supported sources',
  'NotSupportedError',
  'media playback',
  'MEDIA_ERR',
  // Remotion prefetch() rejects with this when the media URL 404s.
  // RemotionPreview also catches this directly; keep here as a safety net.
  'HTTP error, status =',
] as const;

const matchesMediaError = (msg: string): boolean =>
  MEDIA_ERROR_PATTERNS.some((p) => msg.includes(p));

export function ErrorSuppressor() {
  useEffect(() => {
    // Opt-out switch — set NEXT_PUBLIC_DEBUG_VIDEO_ERRORS=1 to see all errors raw.
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_VIDEO_ERRORS === '1') {
      return;
    }

    // 1. console.error: forward non-media errors, drop the rest.
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const first = typeof args[0] === 'string' ? args[0] : '';
      if (matchesMediaError(first)) return;
      origError.apply(console, args);
    };

    // 2. window 'error' events from <video>/<audio> elements: prevent the Next.js
    //    dev overlay from popping for a transient codec failure.
    const onError = (e: ErrorEvent) => {
      const msg = e.message || '';
      const target = e.target as HTMLElement | null;
      const isMediaEl = target instanceof HTMLVideoElement || target instanceof HTMLAudioElement;
      if (isMediaEl || matchesMediaError(msg)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    // 3. Unhandled rejections from media decode pipelines.
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string } | string | null | undefined;
      const msg = typeof reason === 'string' ? reason : reason?.message ?? '';
      if (matchesMediaError(msg)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection, true);

    return () => {
      console.error = origError;
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection, true);
    };
  }, []);

  return null;
}
