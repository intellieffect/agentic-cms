'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatDuration, formatSize } from '@/lib/utils';
import type { FinishedVideo } from '@/lib/types';
import VideoCard from '@/components/video/VideoCard';
import Modal from '@/components/video/Modal';
import TagEditor from '@/components/video/TagEditor';
import styles from './page.module.css';

export default function VideoFinishedPage() {
  const [videos, setVideos] = useState<FinishedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('latest');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<FinishedVideo | null>(null);

  // Upload
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadText, setUploadText] = useState('');
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/finished?limit=200');
      const d = await r.json();
      setVideos(d.videos || []);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const filtered = (() => {
    let list = [...videos];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((v) => (v.name || '').toLowerCase().includes(q));
    if (sort === 'latest') list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    else if (sort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sort === 'size') list.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
    return list;
  })();

  const debounceSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 200);
  };

  const openDetail = async (id: string) => {
    setModalOpen(true);
    try {
      const r = await fetch(`/api/finished/${id}`);
      const d = await r.json();
      setCurrentVideo(d.video || d);
    } catch { /* ignore */ }
  };

  const saveDetail = async () => {
    if (!currentVideo) return;
    const body = {
      name: currentVideo.name,
      tags: currentVideo.tags || [],
      notes: currentVideo.notes || '',
    };
    try {
      const r = await fetch(`/api/finished/${currentVideo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(String(r.status));
      const updated = await r.json();
      setCurrentVideo({ ...currentVideo, ...updated });
      loadVideos();
    } catch (e: unknown) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : e));
    }
  };

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const deleteVideo = () => {
    if (!currentVideo) return;
    setDeleteConfirm({ id: currentVideo.id, name: currentVideo.name || '' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const r = await fetch(`/api/finished/${deleteConfirm.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(String(r.status));
      setDeleteConfirm(null);
      setModalOpen(false);
      setCurrentVideo(null);
      loadVideos();
    } catch (e: unknown) {
      alert('삭제 실패: ' + (e instanceof Error ? e.message : e));
      setDeleteConfirm(null);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    setUploading(true);
    setUploadProgress(0);
    setUploadText(`업로드 중: ${file.name}`);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name.replace(/\.[^/.]+$/, ''));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/finished/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
        setUploadText(`업로드 중: ${pct}%`);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        setUploadText('업로드 완료!');
        setTimeout(() => {
          setUploadOpen(false);
          setUploading(false);
          loadVideos();
        }, 800);
      } else {
        setUploadText('업로드 실패: ' + xhr.status);
        setUploading(false);
      }
    };
    xhr.onerror = () => {
      setUploadText('업로드 실패');
      setUploading(false);
    };
    xhr.send(fd);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">완료 영상</h1>
        <div className="flex-1" />
        <button
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => { setUploadOpen(true); setUploading(false); }}
        >
          업로드
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">정렬</span>
          <select
            className="text-xs bg-muted border border-border rounded-md px-2 py-1 text-foreground"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="latest">최신순</option>
            <option value="name">이름순</option>
            <option value="size">크기순</option>
          </select>
        </div>
        <input
          type="text"
          className="text-xs bg-muted border border-border rounded-md px-3 py-1.5 text-foreground w-48"
          placeholder="이름으로 검색..."
          value={search}
          onChange={(e) => debounceSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{filtered.length}개 영상</span>
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        {loading ? (
          <div className="text-muted-foreground text-sm text-center py-10">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-20">영상이 없습니다</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((v) => {
              const dur = v.duration ? formatDuration(v.duration) : '';
              const size = v.file_size ? formatSize(v.file_size) : '';
              const tags = (v.tags || []).slice(0, 3);
              const date = v.created_at ? new Date(v.created_at).toLocaleDateString('ko-KR') : '';

              return (
                <VideoCard
                  key={v.id}
                  thumbnailUrl={`/api/finished/${v.id}/thumbnail`}
                  streamUrl={`/api/finished/${v.id}/stream`}
                  duration={dur}
                  onClick={() => openDetail(v.id)}
                >
                  <div className={styles.cardTitle}>{v.name || 'Untitled'}</div>
                  <div className={styles.cardMeta}>
                    {dur && <span>&#x23F1; {dur}</span>}
                    {size && <span>&#x1F4E6; {size}</span>}
                  </div>
                  {tags.length > 0 && (
                    <div className={styles.cardTags}>
                      {tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  )}
                  {date && <div className={styles.cardDate}>{date}</div>}
                </VideoCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCurrentVideo(null); }}
        videoSrc={currentVideo ? `/api/finished/${currentVideo.id}/stream` : undefined}
        videoAutoPlay
      >
        {currentVideo ? (
          <>
            <div className={styles.detailSection}>
              <h3>이름</h3>
              <input
                className={styles.detailNameInput}
                value={currentVideo.name || ''}
                onChange={(e) => setCurrentVideo({ ...currentVideo, name: e.target.value })}
                placeholder="영상 이름"
              />
            </div>
            <div className={styles.detailSection}>
              <div className={styles.detailMeta}>
                {currentVideo.duration && <span>&#x23F1; {formatDuration(currentVideo.duration)}</span>}
                {currentVideo.file_size && <span>&#x1F4E6; {formatSize(currentVideo.file_size)}</span>}
                {currentVideo.width && currentVideo.height && <span>&#x1F5A5; {currentVideo.width}x{currentVideo.height}</span>}
                {currentVideo.created_at && (
                  <span>&#x1F4C5; {new Date(currentVideo.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                )}
              </div>
            </div>
            <div className={styles.detailSection}>
              <h3>Tags</h3>
              <TagEditor
                tags={currentVideo.tags || []}
                onChange={(tags) => setCurrentVideo({ ...currentVideo, tags })}
                placeholder="쉼표로 구분"
              />
            </div>
            <div className={styles.detailSection}>
              <h3>Notes</h3>
              <textarea
                rows={3}
                placeholder="메모를 입력하세요..."
                value={currentVideo.notes || ''}
                onChange={(e) => setCurrentVideo({ ...currentVideo, notes: e.target.value })}
                style={{
                  background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px',
                  padding: '8px 10px', color: '#ccc', fontSize: '12px', resize: 'vertical',
                  fontFamily: 'inherit', width: '100%',
                }}
              />
            </div>
            <div className={styles.saveBar}>
              <button
                className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground"
                onClick={saveDetail}
              >
                저장
              </button>
              <a
                className="px-3 py-1.5 rounded text-xs border border-border bg-muted text-foreground inline-flex items-center"
                href={`/api/finished/${currentVideo.id}/stream?download=1&name=${encodeURIComponent((currentVideo.name || 'video') + '.mp4')}`}
              >
                다운로드
              </a>
              {deleteConfirm ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#f87171' }}>정말 삭제?</span>
                  <button className="px-2 py-1 rounded text-xs text-white" style={{ background: '#dc2626' }} onClick={confirmDelete}>확인</button>
                  <button className="px-2 py-1 rounded text-xs border border-border bg-muted text-foreground" onClick={() => setDeleteConfirm(null)}>취소</button>
                </div>
              ) : (
                <button className="px-3 py-1.5 rounded text-xs text-white" style={{ background: '#dc2626' }} onClick={deleteVideo}>삭제</button>
              )}
              <button
                className="px-3 py-1.5 rounded text-xs border border-border bg-muted text-foreground"
                style={{ marginLeft: 'auto' }}
                onClick={() => { setModalOpen(false); setCurrentVideo(null); }}
              >
                닫기
              </button>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground text-sm text-center py-10">불러오는 중...</div>
        )}
      </Modal>

      {/* Upload modal */}
      {uploadOpen && (
        <div className={styles.uploadOverlay} onClick={(e) => { if (e.target === e.currentTarget) setUploadOpen(false); }}>
          <div className={styles.uploadBox}>
            <h2 style={{ fontSize: 14, color: '#ccc', fontWeight: 600 }}>완료 영상 업로드</h2>
            <div
              className={`${styles.dropZone} ${dragover ? styles.dragover : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragover(false);
                if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
              }}
            >
              파일을 드래그하거나 클릭하여 선택
              <br />
              <span style={{ fontSize: 9, color: '#444', marginTop: 4, display: 'inline-block' }}>
                MP4, MOV, WebM
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            {uploading && (
              <div className={styles.uploadProgress}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className={styles.progressText}>{uploadText}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                className="px-3 py-1.5 rounded text-xs border border-border bg-muted text-foreground"
                onClick={() => setUploadOpen(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
