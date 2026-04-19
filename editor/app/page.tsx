'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatDuration } from '@/lib/utils';
import { editorRoute } from '@/lib/editor-routes';
import type { Project } from '@/lib/types';
import styles from './page.module.css';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('latest');
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Create with sources modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/projects');
      const d = await r.json();
      setProjects(d.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Focus rename input when editing starts
  useEffect(() => {
    if (editingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingId]);

  const filtered = (() => {
    let list = [...projects];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => (p.name || '').toLowerCase().includes(q));
    if (sort === 'latest') {
      list.sort((a, b) => {
        const ta = typeof a.updatedAt === 'number' ? a.updatedAt : Date.parse(a.updatedAt as string) || 0;
        const tb = typeof b.updatedAt === 'number' ? b.updatedAt : Date.parse(b.updatedAt as string) || 0;
        return tb - ta;
      });
    } else if (sort === 'name') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'clips') {
      list.sort((a, b) => (b.clipCount || 0) - (a.clipCount || 0));
    }
    return list;
  })();

  const openProject = (id: string) => {
    router.push(editorRoute(`/studio?project=${encodeURIComponent(id)}`));
  };

  // ─── Multi-select ───
  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const unlocked = filtered.filter((p) => !p.locked).map((p) => p.id);
    setSelectedIds(new Set(unlocked));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const names = filtered.filter((p) => selectedIds.has(p.id)).map((p) => p.name || p.id);
    if (!confirm(`${names.length}개 프로젝트를 삭제하시겠습니까?\n\n${names.join('\n')}`)) return;

    let failed = 0;
    for (const id of selectedIds) {
      try {
        const r = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok) failed++;
      } catch {
        failed++;
      }
    }
    if (failed > 0) alert(`${failed}개 삭제 실패`);
    setSelectedIds(new Set());
    setSelectMode(false);
    loadProjects();
  };

  // ─── Rename ───
  const startRename = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    if (p.locked) { alert('🔒 잠금된 프로젝트는 이름을 변경할 수 없습니다.'); return; }
    setEditingId(p.id);
    setEditingName(p.name || '');
  };

  const submitRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) { setEditingId(null); return; }
    try {
      const r = await fetch('/api/projects/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      });
      // Fallback to PATCH if rename endpoint fails
      if (!r.ok) {
        const r2 = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (!r2.ok) throw new Error('rename failed');
      }
      setEditingId(null);
      loadProjects();
    } catch {
      alert('이름 변경 실패');
    }
  };

  // ─── Delete ───
  const deleteProject = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    if (p.locked) { alert('🔒 잠금된 프로젝트는 삭제할 수 없습니다.'); return; }
    if (!confirm(`"${p.name || p.id}" 프로젝트를 삭제하시겠습니까?`)) return;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        if (r.status === 403) { alert('🔒 ' + (d.error || '잠금된 프로젝트입니다.')); return; }
        await fetch('/api/projects/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id }),
        });
      }
      loadProjects();
    } catch {
      alert('삭제 실패');
    }
  };

  // ─── Lock toggle ───
  const toggleLock = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    const newLocked = !p.locked;
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: newLocked }),
      });
      if (!r.ok) throw new Error('toggle failed');
      loadProjects();
    } catch {
      alert('잠금 변경 실패');
    }
  };

  // ─── Quick create (name only) ───
  const quickCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, clips: [], subs: [] }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const newId = d.project?.id;
      setNewName('');
      if (newId) openProject(newId);
      else loadProjects();
    } catch (e: unknown) {
      alert('프로젝트 생성 실패: ' + (e instanceof Error ? e.message : e));
    }
  };

  // ─── Create with source videos ───
  const openCreateModal = () => {
    setCreateOpen(true);
    setCreateName('새 프로젝트 ' + new Date().toLocaleDateString('ko'));
    setSourceFiles([]);
    setCreating(false);
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(f.name));
    setSourceFiles((prev) => [...prev, ...arr]);
  };

  const removeSource = (idx: number) => {
    setSourceFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const createWithSources = async () => {
    if (!sourceFiles.length) { alert('영상 파일을 선택해주세요'); return; }
    const name = createName.trim() || '새 프로젝트';
    setCreating(true);

    try {
      // 1) Upload files to editor directory
      const filenames: string[] = [];
      for (const file of sourceFiles) {
        const fd = new FormData();
        fd.append('files', file);
        const uploadRes = await fetch('/api/resolver/upload', { method: 'POST', body: fd });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          const uploaded = uploadData.files || uploadData.uploaded || [];
          if (uploaded.length > 0) {
            filenames.push(uploaded[0].filename || uploaded[0].name || file.name);
          } else {
            filenames.push(file.name);
          }
        } else {
          filenames.push(file.name);
        }
      }

      // 2) Probe each file for duration
      const clips = await Promise.all(
        filenames.map(async (fname) => {
          try {
            const r = await fetch(`/api/media/probe/${encodeURIComponent(fname)}`);
            if (r.ok) {
              const info = await r.json();
              return { source: fname, start: 0, end: info.duration || 10, subtitle: '' };
            }
          } catch { /* ignore */ }
          return { source: fname, start: 0, end: 10, subtitle: '' };
        })
      );

      // 3) Save project with clips via legacy save API (writes projectData + local JSON)
      const pid = 'proj_' + Date.now();
      const projectData = {
        id: pid,
        name,
        clips,
        subs: [],
        clipMeta: clips.map(() => ({ speed: 1 })),
        transitions: clips.length > 1 ? Array(clips.length - 1).fill({ type: 'none', duration: 0 }) : [],
        clipSubStyles: clips.map(() => ({})),
        clipCrops: clips.map(() => ({ x: 0, y: 0, w: 100, h: 100 })),
        clipZooms: clips.map(() => ({ scale: 1, panX: 0, panY: 0 })),
        clipEffects: clips.map(() => []),
        sources: filenames.map((f) => ({ filename: f })),
      };

      const r = await fetch('/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      const savedId = d.dbId || d.id || pid;

      setCreateOpen(false);
      openProject(savedId);
    } catch (e: unknown) {
      alert('프로젝트 생성 실패: ' + (e instanceof Error ? e.message : e));
    } finally {
      setCreating(false);
    }
  };

  const debounceSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {}, 200);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Top bar */}
      <div className="top-bar">
        <span className="top-bar-title">📁 프로젝트</span>
        <div className="sep" />
        <div className="top-bar-right">
          {selectMode ? (
            <>
              <span style={{ fontSize: 11, color: '#f59e0b' }}>{selectedIds.size}개 선택</span>
              <button className="btn" onClick={selectAll} style={{ fontSize: 11 }}>전체 선택</button>
              <button className="btn" onClick={deselectAll} style={{ fontSize: 11 }}>선택 해제</button>
              <button
                className="btn btn-danger"
                onClick={deleteSelected}
                disabled={selectedIds.size === 0}
                style={{ fontSize: 11 }}
              >
                🗑 선택 삭제 ({selectedIds.size})
              </button>
              <button className="btn" onClick={() => { setSelectMode(false); deselectAll(); }} style={{ fontSize: 11 }}>취소</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setSelectMode(true)} style={{ fontSize: 11 }}>
                ☑️ 선택
              </button>
              <button className="btn btn-pri" onClick={openCreateModal}>
                🎬 영상으로 프로젝트 생성
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <span className="filter-label">정렬</span>
          <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="latest">최신순</option>
            <option value="name">이름순</option>
            <option value="clips">클립수</option>
          </select>
        </div>
        <div className="sep" />
        <div className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="프로젝트 검색..."
            value={search}
            onChange={(e) => debounceSearch(e.target.value)}
          />
        </div>
        <span className="count-label">{filtered.length}개 프로젝트</span>
      </div>

      {/* List */}
      <div className={styles.gridWrap}>
        {loading ? (
          <div className="loading">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">프로젝트가 없습니다</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((p) => {
              const dur = p.totalDuration ? formatDuration(p.totalDuration) : '';
              const ts = typeof p.updatedAt === 'number' ? p.updatedAt * 1000 : Date.parse(p.updatedAt as string);
              const date = !isNaN(ts) ? new Date(ts).toLocaleDateString('ko-KR') : '';
              const srcs = (p.sources || [])
                .slice(0, 3)
                .map((s) => (typeof s === 'object' ? s.filename : s))
                .join(', ');
              const isDb = p.source === 'db';
              const isEditing = editingId === p.id;

              return (
                <div
                  key={p.id}
                  className={`${styles.card} ${selectedIds.has(p.id) ? styles.cardSelected : ''}`}
                  onClick={() => selectMode ? (!p.locked && toggleSelect({stopPropagation: () => {}} as React.MouseEvent, p.id)) : (!isEditing && openProject(p.id))}
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      disabled={!!p.locked}
                      onChange={() => {}}
                      onClick={(e) => { e.stopPropagation(); if (!p.locked) toggleSelect(e, p.id); }}
                      style={{ width: 16, height: 16, cursor: p.locked ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                    />
                  )}
                  <div className={styles.cardIcon}>{isDb ? '☁️' : '📁'}</div>

                  {isEditing ? (
                    <input
                      ref={renameInputRef}
                      className={styles.renameInput}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitRename(p.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => submitRename(p.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className={styles.cardTitle}>{p.name || p.id}</div>
                  )}

                  <div className={styles.cardMeta}>
                    <span>🎬 {p.clipCount || 0}클립</span>
                    {dur && <span>⏱ {dur}</span>}
                  </div>
                  {srcs && <div className={styles.cardSources}>📎 {srcs}</div>}
                  {date && <div className={styles.cardDate}>{date}</div>}
                  <span className={`${styles.cardBadge} ${isDb ? styles.db : styles.local}`}>
                    {isDb ? '☁️ 클라우드' : '💻 로컬'}
                  </span>

                  {/* Action buttons */}
                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      title={p.locked ? '잠금 해제' : '잠금'}
                      onClick={(e) => toggleLock(e, p)}
                      style={{ opacity: p.locked ? 1 : 0.4 }}
                    >{p.locked ? '🔒' : '🔓'}</button>
                    <button
                      className={styles.actionBtn}
                      title="이름 변경"
                      onClick={(e) => startRename(e, p)}
                      style={{ opacity: p.locked ? 0.3 : 1, pointerEvents: p.locked ? 'none' : 'auto' }}
                    >✏️</button>
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      title="삭제"
                      onClick={(e) => deleteProject(e, p)}
                      style={{ opacity: p.locked ? 0.3 : 1, pointerEvents: p.locked ? 'none' : 'auto' }}
                    >🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>



      {/* ─── Create with sources modal ─── */}
      {createOpen && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>🎬 영상으로 프로젝트 생성</h2>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>프로젝트 이름</label>
              <input
                type="text"
                className={styles.modalInput}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="프로젝트 이름"
              />
            </div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>영상 소스 ({sourceFiles.length}개 선택)</label>
              <div
                className={styles.dropZone}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileSelect(e.dataTransfer.files);
                }}
              >
                📂 파일을 드래그하거나 클릭하여 선택
                <br />
                <span style={{ fontSize: 9, color: '#555' }}>MP4, MOV, WebM, AVI, MKV</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {/* Selected files */}
            {sourceFiles.length > 0 && (
              <div className={styles.sourceList}>
                {sourceFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className={styles.sourceItem}>
                    <span className={styles.sourceIcon}>🎬</span>
                    <span className={styles.sourceName}>{f.name}</span>
                    <span className={styles.sourceSize}>{formatFileSize(f.size)}</span>
                    <button
                      className={styles.sourceRemove}
                      onClick={() => removeSource(i)}
                      title="제거"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <button className="btn" onClick={() => setCreateOpen(false)}>취소</button>
              <button
                className="btn btn-pri"
                onClick={createWithSources}
                disabled={creating || sourceFiles.length === 0}
              >
                {creating ? '생성 중...' : `🚀 프로젝트 생성 (${sourceFiles.length}개 영상)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
