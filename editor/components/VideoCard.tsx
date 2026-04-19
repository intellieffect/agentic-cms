'use client';

import { useRef, useCallback } from 'react';
import styles from './VideoCard.module.css';

interface VideoCardProps {
  thumbnailUrl: string;
  streamUrl: string;
  duration?: string;
  platformIcon?: string;
  favorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onClick: () => void;
  children: React.ReactNode;
}

export default function VideoCard({
  thumbnailUrl,
  streamUrl,
  duration,
  platformIcon,
  favorite,
  onToggleFavorite,
  onClick,
  children,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
      vid.currentTime = 0;
    }
  }, []);

  return (
    <div
      className={styles.card}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.thumb}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <video
          ref={videoRef}
          src={streamUrl}
          muted
          loop
          playsInline
          preload="none"
          className={styles.video}
        />
        {duration && <span className={styles.duration}>{duration}</span>}
        {platformIcon && <span className={styles.platform}>{platformIcon}</span>}
        {onToggleFavorite && (
          <button
            className={`${styles.favBtn} ${favorite ? styles.favActive : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(e); }}
            title={favorite ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            {favorite ? '★' : '☆'}
          </button>
        )}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
