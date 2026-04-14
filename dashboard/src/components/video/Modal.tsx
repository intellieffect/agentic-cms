'use client';

import { useEffect, useRef, useCallback } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  videoSrc?: string;
  videoAutoPlay?: boolean;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, videoSrc, videoAutoPlay, children }: ModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleClose = useCallback(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.src = '';
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={styles.modal}>
        {videoSrc && (
          <div className={styles.videoPane}>
            <button className={styles.close} onClick={handleClose}>&#x2715;</button>
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              playsInline
              autoPlay={videoAutoPlay}
            />
          </div>
        )}
        <div className={styles.detail}>{children}</div>
      </div>
    </div>
  );
}
