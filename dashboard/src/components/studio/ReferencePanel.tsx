'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';

interface RefVideo {
  id: string;
  caption: string;
  thumbnail_url: string;
  video_url: string;
  duration_sec: number;
  like_count: number;
  account_id: string;
}

export const ReferencePanel: React.FC = () => {
  const [videos, setVideos] = useState<RefVideo[]>([]);
  const [selectedRef, setSelectedRef] = useState<RefVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const refVideoRef = useRef<HTMLVideoElement>(null);
  const referenceId = useEditorStore((s) => s.referenceId);
  const setReferenceId = useEditorStore((s) => s.setReferenceId);

  useEffect(() => {
    fetch(`${getEditorConfig().apiUrl}/api/references/videos?limit=30&sort=likes`)
      .then((r) => r.json())
      .then((d) => {
        const apiUrl = getEditorConfig().apiUrl;
        const vids = (d.videos || []).map((v: RefVideo) => ({
          ...v,
          thumbnail_url: v.thumbnail_url && v.thumbnail_url.startsWith('/') ? `${apiUrl}${v.thumbnail_url}` : v.thumbnail_url,
          video_url: v.video_url && v.video_url.startsWith('/') ? `${apiUrl}${v.video_url}` : v.video_url,
        }));
        setVideos(vids);
        // 저장된 referenceId가 있으면 자동 선택
        if (referenceId) {
          const saved = vids.find((v: RefVideo) => v.id === referenceId);
          if (saved) setSelectedRef(saved);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectRef = (v: RefVideo) => {
    setSelectedRef(v);
    setReferenceId(v.id);
  };

  return (
    <div className="studio-panel-content studio-panel-content-reference" style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* 왼쪽: 레퍼런스 영상 재생 (40%) */}
      <div className="studio-reference-preview-card" style={{
        flex: 4,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #2a2a2a',
        minWidth: 0,
      }}>
        <div className="studio-panel-header-card" style={{ padding: '8px 10px', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
          <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: 11 }}>🎬 레퍼런스</span>
        </div>

        {selectedRef ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 8 }}>
            <div style={{
              background: '#000',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: 600,
              flexShrink: 0,
            }}>
              <video
                ref={refVideoRef}
                src={selectedRef.video_url}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                controls
                loop
                playsInline
              />
            </div>
            <div style={{ marginTop: 6, color: '#ccc', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedRef.caption?.slice(0, 80) || selectedRef.id}
            </div>
            <div style={{ color: '#666', fontSize: 9, marginTop: 2 }}>
              {selectedRef.duration_sec}s · ❤️{selectedRef.like_count?.toLocaleString()}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => { const rv = refVideoRef.current; if (rv) { rv.paused ? rv.play() : rv.pause(); } }}
                className="be-btn"
                style={{ flex: 1, fontSize: 10, padding: '5px 0' }}
              >▶ 재생/정지</button>
              <button
                onClick={() => { const rv = refVideoRef.current; if (rv) rv.currentTime = 0; }}
                className="be-btn"
                style={{ flex: 1, fontSize: 10, padding: '5px 0' }}
              >⏮ 처음</button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 11 }}>
            오른쪽 목록에서 레퍼런스를 선택하세요
          </div>
        )}
      </div>

      {/* 오른쪽: 레퍼런스 리스트 (60%) */}
      <div className="studio-reference-list-card" style={{
        flex: 6,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div className="studio-panel-header-card" style={{ padding: '8px 10px', borderBottom: '1px solid #2a2a2a', flexShrink: 0 }}>
          <span style={{ color: '#888', fontWeight: 600, fontSize: 10 }}>목록 ({videos.length})</span>
        </div>

        {loading && <div style={{ padding: 10, color: '#555', fontSize: 10 }}>불러오는 중...</div>}

        <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 6,
          }}>
            {videos.map((v) => (
              <div
                className="studio-reference-thumb"
                key={v.id}
                onClick={() => selectRef(v)}
                style={{
                  background: selectedRef?.id === v.id ? '#1e1b4b' : '#1a1a1a',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: selectedRef?.id === v.id ? '2px solid #7c3aed' : '2px solid transparent',
                  transition: 'background .15s, border .15s',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => { if (selectedRef?.id !== v.id) e.currentTarget.style.background = '#222'; }}
                onMouseLeave={(e) => { if (selectedRef?.id !== v.id) e.currentTarget.style.background = '#1a1a1a'; }}
              >
                {v.thumbnail_url ? (
                  <img
                    src={v.thumbnail_url}
                    style={{ width: '100%', aspectRatio: '9/16', objectFit: 'cover', display: 'block' }}
                    alt=""
                  />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '9/16', background: '#333' }} />
                )}
                <div style={{ padding: '4px 5px' }}>
                  <div style={{ color: '#ccc', fontSize: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.caption?.slice(0, 20) || v.id}
                  </div>
                  <div style={{ color: '#666', fontSize: 7, marginTop: 1 }}>
                    {v.duration_sec}s · ❤️{v.like_count?.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
