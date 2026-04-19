'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDuration, fmtNum } from '@/lib/utils';
import { editorRoute } from '@/lib/editor-routes';
import type { ReferenceAccount, ReferenceVideo } from '@/lib/types';
import VideoCard from '@/components/VideoCard';
import Modal from '@/components/Modal';
import TagEditor from '@/components/TagEditor';
import CollectionsPanel from '@/components/references/CollectionsPanel';
import styles from './page.module.css';

const ALL_STYLE_TAGS = [
  'vlog', 'cinematic', 'montage', 'tutorial', 'aesthetic',
  'minimal', 'fast-cut', 'slow-motion', 'transition', 'storytelling',
];
const PAGE_SIZE = 50;

type RefTab = 'videos' | 'collections';

// ─── Favorites (DB-backed) ───

export default function ReferencesPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ReferenceAccount[]>([]);
  const [videos, setVideos] = useState<ReferenceVideo[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [currentAccount, setCurrentAccount] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [platform, setPlatform] = useState('');
  const [sort, setSort] = useState('latest');
  const [activeStyles, setActiveStyles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites from DB on mount
  useEffect(() => {
    fetch('/api/references/favorites')
      .then((r) => r.json())
      .then((d) => {
        const ids = (d.videos || []).map((v: { id: string }) => v.id);
        setFavorites(new Set(ids));
      })
      .catch(() => {});
  }, []);

  const toggleFavorite = async (id: string) => {
    const wasFav = favorites.has(id);
    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await fetch(`/api/references/videos/${id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !wasFav }),
      });
    } catch {
      // Revert on failure
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(id);
        else next.delete(id);
        return next;
      });
    }
  };

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<ReferenceVideo | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const r = await fetch('/api/references/accounts');
      const d = await r.json();
      setAccounts(d.accounts || []);
    } catch { /* ignore */ }
  }, []);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (currentAccount) params.set('account', currentAccount);
    if (platform) params.set('platform', platform);
    params.set('sort', sort);
    if (activeStyles.size > 0) params.set('style', [...activeStyles][0]);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(currentPage * PAGE_SIZE));

    try {
      const r = await fetch(`/api/references/videos?${params}`);
      const d = await r.json();
      const vids = d.videos || [];
      setVideos(vids);
      setTotalVideos(d.total || vids.length);
      // Sync favorites from video data
      setFavorites((prev) => {
        const next = new Set(prev);
        for (const v of vids) {
          if (v.favorite) next.add(v.id);
        }
        return next;
      });
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, platform, sort, activeStyles, currentPage]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { loadVideos(); }, [loadVideos]);

  const totalPages = Math.ceil(totalVideos / PAGE_SIZE);

  const toggleStyle = (tag: string) => {
    setActiveStyles((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
    setCurrentPage(0);
  };

  const selectAccount = (id: string) => {
    setCurrentAccount(id);
    setCurrentPage(0);
  };

  // Modal
  const openDetail = async (id: string) => {
    setModalOpen(true);
    try {
      const r = await fetch(`/api/references/videos/${id}`);
      const data = await r.json();
      setCurrentVideo(data);
    } catch { /* ignore */ }
  };

  const saveDetail = async () => {
    if (!currentVideo) return;
    const body = {
      style_tags: currentVideo.style_tags || [],
      transition_tags: currentVideo.transition_tags || [],
      music_tags: currentVideo.music_tags || [],
      notes: currentVideo.notes || '',
      music_artist: currentVideo.music_artist || null,
      music_title: currentVideo.music_title || null,
    };
    try {
      const r = await fetch(`/api/references/videos/${currentVideo.id}`, {
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

  const createProjectFromRef = async () => {
    if (!currentVideo) return;
    const accountName = currentVideo.account_name || currentVideo.username || '';
    const name = accountName ? `${accountName} 프로젝트` : '레퍼런스 프로젝트';
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          projectData: {
            referenceId: currentVideo.id,
            styleTags: currentVideo.style_tags || [],
            caption: currentVideo.caption || '',
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      const projectId = d.project?.id;
      if (projectId) {
        setModalOpen(false);
        router.push(editorRoute(`/editor?project=${encodeURIComponent(projectId)}`));
      }
    } catch (e: unknown) {
      alert('프로젝트 생성 실패: ' + (e instanceof Error ? e.message : e));
    }
  };

  const importVideo = async () => {
    const url = importUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const r = await fetch('/api/references/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setImportUrl('');
      loadVideos();
      loadAccounts();
    } catch (e: unknown) {
      alert('임포트 실패: ' + (e instanceof Error ? e.message : e));
    } finally {
      setImporting(false);
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!confirm('이 레퍼런스 영상을 삭제하시겠습니까?')) return;
    try {
      const r = await fetch(`/api/references/videos/${videoId}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || String(r.status));
      }
      loadVideos();
    } catch (e: unknown) {
      alert('삭제 실패: ' + (e instanceof Error ? e.message : e));
    }
  };

  const getPlatformIcon = (p?: string) => {
    if (p === 'instagram') return '📷';
    if (p === 'youtube') return '▶️';
    if (p === 'tiktok') return '🎵';
    return '';
  };

  const [activeTab, setActiveTab] = useState<RefTab>('videos');

  return (
    <>
      {/* Top bar */}
      <div className="top-bar">
        <span className="top-bar-title">🎬 레퍼런스</span>
        <div className="sep" />
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['videos', 'collections'] as RefTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                background: activeTab === tab ? '#FF6B35' : '#222',
                color: activeTab === tab ? '#fff' : '#888',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {tab === 'videos' ? '🎬 영상' : '📁 컬렉션'}
            </button>
          ))}
        </div>
        <div className="sep" />
        <div className="top-bar-right">
          <input
            type="text"
            className={styles.importInput}
            placeholder="영상 URL 붙여넣기 (Instagram, YouTube, TikTok...)"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') importVideo(); }}
          />
          <button className="btn btn-pri" onClick={importVideo} disabled={importing}>
            {importing ? '⏳ 임포트 중...' : '임포트'}
          </button>
        </div>
      </div>

      {/* Collections tab */}
      {activeTab === 'collections' && <CollectionsPanel />}

      {/* Main layout (videos tab) */}
      <div className={styles.main} style={{ display: activeTab === 'videos' ? undefined : 'none' }}>
        {/* Sidebar removed */}

        {/* Content */}
        <div className={styles.content}>
          {/* Filters */}
          <div className="filters">
            <div className="filter-group">
              <span className="filter-label">플랫폼</span>
              <select className="filter-select" value={platform} onChange={(e) => { setPlatform(e.target.value); setCurrentPage(0); }}>
                <option value="">전체</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">정렬</span>
              <select className="filter-select" value={sort} onChange={(e) => { setSort(e.target.value); setCurrentPage(0); }}>
                <option value="latest">최신순</option>
                <option value="name">이름순</option>
              </select>
            </div>
            <div className="sep" />
            <div className="filter-group">
              <span className="filter-label">스타일</span>
              <div className={styles.tagFilter}>
                {ALL_STYLE_TAGS.map((t) => (
                  <span
                    key={t}
                    className={`${styles.tagChip} ${activeStyles.has(t) ? styles.tagChipActive : ''}`}
                    onClick={() => toggleStyle(t)}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Grid */}
          <div className={styles.gridWrap}>
            {loading ? (
              <div className="loading">불러오는 중...</div>
            ) : videos.length === 0 ? (
              <div className="empty">영상이 없습니다</div>
            ) : (
              <div className={styles.grid}>
                {/* Sort: favorites first, then original order */}
                {[...videos].sort((a, b) => {
                  const fa = favorites.has(a.id) ? 1 : 0;
                  const fb = favorites.has(b.id) ? 1 : 0;
                  return fb - fa;
                }).map((v) => {
                  const title = (v.caption || '').split('\n')[0].slice(0, 60) || '제목 없음';
                  const dur = v.duration_sec ? formatDuration(v.duration_sec) : '';
                  const tags = (v.style_tags || []).slice(0, 3);
                  const date = v.created_at ? new Date(v.created_at).toLocaleDateString('ko-KR') : '';
                  const streamUrl = v.video_url || `/api/references/videos/${v.id}/stream`;
                  const isFav = favorites.has(v.id);

                  return (
                    <VideoCard
                      key={v.id}
                      thumbnailUrl={`/api/references/videos/${v.id}/thumbnail`}
                      streamUrl={streamUrl}
                      duration={dur}
                      platformIcon={getPlatformIcon(v.platform)}
                      favorite={isFav}
                      onToggleFavorite={() => toggleFavorite(v.id)}
                      onClick={() => openDetail(v.id)}
                    >
                      <div className={styles.cardTitle}>{title}</div>
                      <div className={styles.cardStats}>
                        {v.like_count != null && <span>❤️ {fmtNum(v.like_count)}</span>}
                        {v.comment_count != null && <span>💬 {fmtNum(v.comment_count)}</span>}
                        {v.view_count != null && <span>👁 {fmtNum(v.view_count)}</span>}
                      </div>
                      {(v.music_artist || v.music_title) && (
                        <div className={styles.cardMusic}>
                          🎵 {[v.music_artist, v.music_title].filter(Boolean).join(' — ')}
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className={styles.cardTags}>
                          {tags.map((t) => (
                            <span key={t} className="tag">{t}</span>
                          ))}
                        </div>
                      )}
                      {date && <div className={styles.cardDate}>{date}</div>}
                      <div className={styles.cardId} title={v.id}>ID: {v.id.slice(0, 8)}</div>
                    </VideoCard>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className="btn" disabled={currentPage === 0} onClick={() => setCurrentPage((p) => p - 1)}>
                ← 이전
              </button>
              <span className={styles.pageInfo}>{currentPage + 1} / {totalPages}</span>
              <button className="btn" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)}>
                다음 →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCurrentVideo(null); }}
        videoSrc={currentVideo ? `/api/references/videos/${currentVideo.id}/stream` : undefined}
      >
        {currentVideo ? (
          <>
            <div className={styles.detailSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <code style={{ fontSize: '11px', color: '#6b7280', background: '#1f2937', padding: '2px 8px', borderRadius: '4px', userSelect: 'all' }}>
                  {currentVideo.id}
                </code>
                <button
                  className="btn"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                  onClick={() => { navigator.clipboard.writeText(currentVideo.id); }}
                  title="ID 복사"
                >
                  📋
                </button>
              </div>
              <div className={styles.detailCaption}>{currentVideo.caption || ''}</div>
            </div>
            {/* Stats removed — not meaningful for reference workflow */}
            <div className={styles.detailSection}>
              <div className={styles.detailMeta}>
                {(currentVideo.account_name || currentVideo.username) && (
                  <span>👤 {currentVideo.account_name || currentVideo.username}</span>
                )}
                {currentVideo.platform && <span>📱 {currentVideo.platform}</span>}
                {currentVideo.url && (
                  <a href={currentVideo.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '11px' }}>
                    🔗 원본 보기
                  </a>
                )}
                {!currentVideo.url && currentVideo.platform === 'instagram' && currentVideo.id && (
                  <a href={`https://www.instagram.com/reel/${currentVideo.id}/`} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '11px' }}>
                    🔗 Instagram
                  </a>
                )}
                {currentVideo.created_at && (
                  <span>📅 {new Date(currentVideo.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                )}
                {currentVideo.duration_sec && <span>⏱ {formatDuration(currentVideo.duration_sec)}</span>}
              </div>
            </div>
            <div className={styles.detailSection}>
              <h3>🎵 Music</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="아티스트"
                  value={currentVideo.music_artist || ''}
                  onChange={(e) => setCurrentVideo({ ...currentVideo, music_artist: e.target.value })}
                  style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', color: '#a78bfa', fontSize: '13px' }}
                />
                <input
                  type="text"
                  placeholder="곡명"
                  value={currentVideo.music_title || ''}
                  onChange={(e) => setCurrentVideo({ ...currentVideo, music_title: e.target.value })}
                  style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '6px 8px', color: '#a78bfa', fontSize: '13px' }}
                />
                <button
                  className="btn"
                  style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
                  onClick={() => {
                    const q = [currentVideo.music_artist, currentVideo.music_title].filter(Boolean).join(' - ');
                    if (q) window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, '_blank');
                  }}
                >
                  ▶️ YouTube
                </button>
                <button
                  className="btn"
                  style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
                  onClick={async () => {
                    try {
                      const r = await fetch(`/api/references/recognize-music/${currentVideo.id}`, { method: 'POST' });
                      const d = await r.json();
                      if (d.result) {
                        setCurrentVideo({ ...currentVideo, music_artist: d.result.artist, music_title: d.result.title });
                      } else {
                        alert(d.message || '음악을 인식하지 못했습니다');
                      }
                    } catch { alert('인식 실패'); }
                  }}
                >
                  🔍 자동인식
                </button>
              </div>
            </div>
            <div className={styles.detailSection}>
              <h3>Style Tags</h3>
              <TagEditor
                tags={currentVideo.style_tags || []}
                onChange={(tags) => setCurrentVideo({ ...currentVideo, style_tags: tags })}
              />
            </div>
            <div className={styles.detailSection}>
              <h3>Transition Tags</h3>
              <TagEditor
                tags={currentVideo.transition_tags || []}
                onChange={(tags) => setCurrentVideo({ ...currentVideo, transition_tags: tags })}
              />
            </div>
            <div className={styles.detailSection}>
              <h3>Music Tags</h3>
              <TagEditor
                tags={currentVideo.music_tags || []}
                onChange={(tags) => setCurrentVideo({ ...currentVideo, music_tags: tags })}
              />
            </div>
            <div className={styles.detailSection}>
              <h3>Notes</h3>
              <textarea
                className="notes-area"
                rows={3}
                placeholder="메모를 입력하세요..."
                value={currentVideo.notes || ''}
                onChange={(e) => setCurrentVideo({ ...currentVideo, notes: e.target.value })}
              />
            </div>
            <div className={styles.saveBar}>
              <button
                className="btn"
                style={favorites.has(currentVideo.id) ? { background: '#78350f', borderColor: '#b45309', color: '#fbbf24' } : {}}
                onClick={() => toggleFavorite(currentVideo.id)}
              >
                {favorites.has(currentVideo.id) ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}
              </button>
              <button className="btn btn-pri" onClick={saveDetail}>💾 저장</button>
              <button
                className="btn"
                style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}
                onClick={createProjectFromRef}
              >
                🚀 프로젝트 생성
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                onClick={() => {
                  deleteVideo(currentVideo.id);
                  setModalOpen(false);
                  setCurrentVideo(null);
                }}
              >
                🗑️ 삭제
              </button>
              <button className="btn" onClick={() => { setModalOpen(false); setCurrentVideo(null); }}>닫기</button>
            </div>
          </>
        ) : (
          <div className="loading">불러오는 중...</div>
        )}
      </Modal>
    </>
  );
}
