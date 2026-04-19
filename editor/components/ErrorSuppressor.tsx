'use client';

import { useEffect } from 'react';

/**
 * Globally suppress video-related errors that occur when:
 * - HEVC originals are served before proxy is ready
 * - Remotion's <Video> fires console.error internally
 * - Browser can't decode certain codecs
 *
 * Mount once in LayoutShell to cover ALL pages.
 */
export function ErrorSuppressor() {
  useEffect(() => {
    // 1. Suppress Remotion's "Error occurred in video" console.error
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const first = typeof args[0] === 'string' ? args[0] : '';
      if (
        first.includes('Error occurred in video') ||
        first.includes('The browser threw an error while playing the video') ||
        first.includes('supported sources') ||
        first.includes('NotSupportedError')
      ) {
        return; // swallow
      }
      origError.apply(console, args);
    };

    // 2. Suppress window error events (Next.js dev overlay)
    const onError = (e: ErrorEvent) => {
      const msg = e.message || '';
      if (
        msg.includes('supported sources') ||
        msg.includes('NotSupportedError') ||
        msg.includes('media playback') ||
        msg.includes('MEDIA_ERR')
      ) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    // 3. Suppress unhandled promise rejections
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message || String(e.reason || '');
      if (
        msg.includes('supported sources') ||
        msg.includes('NotSupportedError') ||
        msg.includes('media playback') ||
        msg.includes('MEDIA_ERR')
      ) {
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
