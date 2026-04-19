'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { editorRoute } from '@/lib/editor-routes'

/* ─── Types ─── */

interface SubtitleItem {
  text: string
  start_offset: number
  end_offset: number
  style: { size: number; x: number; y: number; color: string }
}

interface Visual {
  type: 'carousel_slide' | 'video_clip' | 'image' | 'color'
  carousel_id?: string | null
  slide_index?: number
  source?: string
  start?: number
  end?: number
  color?: string
}

interface Camera {
  zoom: { start: number; end: number }
  speed: number
}

interface TransitionObj {
  type: string
  duration: number
}

interface Scene {
  scene_id: number
  duration_sec: number
  visual: Visual
  camera: Camera
  subtitles: SubtitleItem[]
  narration: string
  transition: TransitionObj
}

interface Storyboard {
  id: string
  title: string
  source_text: string
  carousel_id: string | null
  scenes: Scene[]
  format: { width: number; height: number; fps: number }
  bgm: { mood: string; source: string | null; volume: number }
  total_duration_sec: number
  created_at: string
  updated_at: string
}

/* ─── Defaults ─── */

const defaultVisual: Visual = { type: 'carousel_slide', carousel_id: null, slide_index: 0 }
const defaultCamera: Camera = { zoom: { start: 1.0, end: 1.0 }, speed: 1.0 }
const defaultTransition: TransitionObj = { type: 'fade', duration: 0.5 }

function makeScene(id: number): Scene {
  return {
    scene_id: id,
    duration_sec: 5,
    visual: { ...defaultVisual },
    camera: { zoom: { start: 1.0, end: 1.0 }, speed: 1.0 },
    subtitles: [],
    narration: '',
    transition: { type: 'fade', duration: 0.5 },
  }
}

/* ─── Label helper ─── */
const lbl: React.CSSProperties = { fontSize: 10, color: '#888', display: 'block', marginBottom: 4 }
const sectionTitle: React.CSSProperties = { fontSize: 11, color: '#ff6b35', fontWeight: 600, marginBottom: 8 }

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export default function StoryboardDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [sb, setSb] = useState<Storyboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)

  /* ─── Load ─── */
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/content/storyboards/${id}`)
      if (!r.ok) { router.push(editorRoute('/content/storyboard')); return }
      const d = await r.json()
      // Migrate old format fields
      if (!d.format) d.format = { width: 1080, height: 1920, fps: 30 }
      if (!d.bgm) d.bgm = { mood: d.bgm_mood || 'calm', source: null, volume: 60 }
      if (d.scenes) {
        d.scenes = d.scenes.map((s: Record<string, unknown>) => ({
          scene_id: s.scene_id ?? 1,
          duration_sec: s.duration_sec ?? 5,
          visual: s.visual ?? { type: s.visual_type === 'video' ? 'video_clip' : s.visual_type === 'image' ? 'image' : 'carousel_slide', carousel_id: null, slide_index: s.slide_index ?? 0 },
          camera: s.camera ?? { ...defaultCamera },
          subtitles: s.subtitles ?? [],
          narration: s.narration ?? '',
          transition: typeof s.transition === 'object' && s.transition !== null ? s.transition : { type: (s.transition as string) || 'fade', duration: 0.5 },
        }))
      }
      setSb(d)
    } catch { router.push(editorRoute('/content/storyboard')) }
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  /* ─── Save ─── */
  const save = async (updated: Storyboard) => {
    setSaving(true)
    try {
      const totalDur = updated.scenes.reduce((sum, s) => sum + s.duration_sec, 0)
      await fetch(`/api/content/storyboards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updated.title,
          scenes: updated.scenes,
          format: updated.format,
          bgm: updated.bgm,
          total_duration_sec: totalDur,
        }),
      })
      setSb({ ...updated, total_duration_sec: totalDur })
    } catch { alert('저장 실패') }
    setSaving(false)
  }

  /* ─── Scene ops ─── */
  const addScene = () => {
    if (!sb) return
    const updated = { ...sb, scenes: [...sb.scenes, makeScene(sb.scenes.length + 1)] }
    setSb(updated)
    setSelectedIdx(updated.scenes.length - 1)
  }

  const removeScene = (idx: number) => {
    if (!sb || sb.scenes.length <= 1) return
    const scenes = sb.scenes.filter((_, i) => i !== idx).map((s, i) => ({ ...s, scene_id: i + 1 }))
    setSb({ ...sb, scenes })
    if (selectedIdx >= scenes.length) setSelectedIdx(Math.max(0, scenes.length - 1))
  }

  const duplicateScene = (idx: number) => {
    if (!sb) return
    const orig = sb.scenes[idx]
    const dup: Scene = JSON.parse(JSON.stringify(orig))
    const scenes = [...sb.scenes]
    scenes.splice(idx + 1, 0, dup)
    const renumbered = scenes.map((s, i) => ({ ...s, scene_id: i + 1 }))
    setSb({ ...sb, scenes: renumbered })
    setSelectedIdx(idx + 1)
  }

  const updateScene = (idx: number, patch: Partial<Scene>) => {
    if (!sb) return
    const scenes = sb.scenes.map((s, i) => i === idx ? { ...s, ...patch } : s)
    setSb({ ...sb, scenes })
  }

  /* ─── Subtitle ops ─── */
  const addSubtitle = (sceneIdx: number) => {
    if (!sb) return
    const scene = sb.scenes[sceneIdx]
    const newSub: SubtitleItem = { text: '', start_offset: 0, end_offset: scene.duration_sec, style: { size: 18, x: 50, y: 80, color: '#ffffff' } }
    updateScene(sceneIdx, { subtitles: [...scene.subtitles, newSub] })
  }

  const removeSubtitle = (sceneIdx: number, subIdx: number) => {
    if (!sb) return
    const subs = sb.scenes[sceneIdx].subtitles.filter((_, i) => i !== subIdx)
    updateScene(sceneIdx, { subtitles: subs })
  }

  const updateSubtitle = (sceneIdx: number, subIdx: number, patch: Partial<SubtitleItem>) => {
    if (!sb) return
    const subs = sb.scenes[sceneIdx].subtitles.map((s, i) => i === subIdx ? { ...s, ...patch } : s)
    updateScene(sceneIdx, { subtitles: subs })
  }

  /* ─── Generate subtitles ─── */
  const handleGenerateSubtitles = async () => {
    if (!sb) return
    try {
      const r = await fetch(`/api/content/storyboards/${id}/generate-subtitles`, { method: 'POST' })
      const d = await r.json()
      if (d.ok && d.scenes) {
        setSb({ ...sb, scenes: d.scenes })
        alert(`자막 자동 생성 완료 (${d.scene_count}개 씬)`)
      } else {
        alert(d.error || '자막 생성 실패')
      }
    } catch { alert('자막 생성 실패') }
  }

  /* ─── Export project ─── */
  const handleExportProject = async () => {
    if (!sb) return
    // Save first
    await save(sb)
    try {
      const r = await fetch(`/api/content/storyboards/${id}/export-project`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) {
        alert(d.message || 'Remotion 프로젝트 변환 완료')
      } else {
        alert(d.error || '내보내기 실패')
      }
    } catch { alert('내보내기 실패') }
  }

  /* ─── Render ─── */
  if (loading) return <div className="loading">불러오는 중...</div>
  if (!sb) return <div className="empty">콘티를 찾을 수 없습니다.</div>

  const selected = sb.scenes[selectedIdx] || null

  const formatLabel = (f: { width: number; height: number }) => {
    if (f.width === 1080 && f.height === 1920) return '세로 9:16'
    if (f.width === 1080 && f.height === 1080) return '정방형 1:1'
    if (f.width === 1080 && f.height === 1350) return '4:5'
    return `${f.width}×${f.height}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ═══ Top bar ═══ */}
      <div className="top-bar" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button className="btn" onClick={() => router.push(editorRoute('/content/storyboard'))} style={{ fontSize: 10 }}>← 목록</button>
        <div className="sep" />
        <input
          value={sb.title}
          onChange={(e) => setSb({ ...sb, title: e.target.value })}
          style={{ background: 'transparent', border: 'none', color: '#fafafa', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', width: 180 }}
        />
        <div className="sep" />
        {/* Format select */}
        <select
          className="filter-select"
          value={`${sb.format.width}x${sb.format.height}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number)
            setSb({ ...sb, format: { ...sb.format, width: w, height: h } })
          }}
          style={{ fontSize: 10 }}
        >
          <option value="1080x1920">세로 9:16</option>
          <option value="1080x1080">정방형 1:1</option>
          <option value="1080x1350">4:5</option>
        </select>
        {/* BGM */}
        <select
          className="filter-select"
          value={sb.bgm.mood}
          onChange={(e) => setSb({ ...sb, bgm: { ...sb.bgm, mood: e.target.value } })}
          style={{ fontSize: 10 }}
        >
          {['calm', 'upbeat', 'cinematic', 'emotional', 'energetic', 'lo-fi', 'ambient'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span style={{ fontSize: 9, color: '#666' }}>Vol</span>
        <input
          type="range" min={0} max={100} value={sb.bgm.volume}
          onChange={(e) => setSb({ ...sb, bgm: { ...sb.bgm, volume: parseInt(e.target.value) } })}
          style={{ width: 60, accentColor: '#2563eb' }}
        />
        <span style={{ fontSize: 9, color: '#888' }}>{sb.bgm.volume}%</span>

        <div className="top-bar-right">
          <button className="btn" onClick={handleGenerateSubtitles} style={{ fontSize: 10 }}>
            자막 생성
          </button>
          <button className="btn btn-pri" onClick={() => save(sb)} disabled={saving} style={{ fontSize: 10 }}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            className="btn"
            onClick={handleExportProject}
            style={{ fontSize: 10, background: '#ff6b35', borderColor: '#ff6b35', color: '#fff' }}
          >
            영상 프로젝트 내보내기
          </button>
        </div>
      </div>

      {/* ═══ Main 3-panel layout ═══ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ─── Left: Scene timeline ─── */}
        <div style={{ width: 300, borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#888' }}>씬 타임라인 ({sb.scenes.length})</span>
            <button className="btn" onClick={addScene} style={{ fontSize: 9, padding: '2px 6px' }}>+ 씬 추가</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {sb.scenes.map((scene, idx) => {
              const vis = scene.visual
              const typeLabel = vis.type === 'carousel_slide' ? 'Slide' : vis.type === 'video_clip' ? 'Video' : vis.type === 'image' ? 'Image' : 'Color'
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #1a1a1a',
                    cursor: 'pointer',
                    background: idx === selectedIdx ? '#1e3a5f' : 'transparent',
                    transition: 'background .1s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: idx === selectedIdx ? '#60a5fa' : '#ccc', fontWeight: 500 }}>
                      씬 {scene.scene_id}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="tag">{typeLabel}</span>
                      <span style={{ fontSize: 9, color: '#666' }}>{scene.duration_sec}s</span>
                    </div>
                  </div>
                  {/* Mini preview info */}
                  <div style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scene.narration || '(나레이션 없음)'}
                  </div>
                  {scene.subtitles.length > 0 && (
                    <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>
                      자막 {scene.subtitles.length}개 · {scene.transition.type}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Timeline footer */}
          <div style={{ padding: '6px 10px', borderTop: '1px solid #1a1a1a', fontSize: 9, color: '#555' }}>
            총 {Math.round(sb.scenes.reduce((s, sc) => s + sc.duration_sec, 0))}초 · {formatLabel(sb.format)}
          </div>
        </div>

        {/* ─── Center: Preview ─── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', overflow: 'hidden' }}>
          {selected ? (
            <div style={{ textAlign: 'center' }}>
              {/* Preview box */}
              <div style={{
                width: 240,
                height: sb.format.height / sb.format.width * 240,
                background: selected.visual.type === 'color' ? (selected.visual.color || '#000') : '#141414',
                border: '1px solid #333',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                margin: '0 auto',
              }}>
                {selected.visual.type === 'carousel_slide' && (
                  <div style={{ textAlign: 'center', color: '#555' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🖼</div>
                    <div style={{ fontSize: 10 }}>Slide {(selected.visual.slide_index ?? 0) + 1}</div>
                    {selected.visual.carousel_id && (
                      <div style={{ fontSize: 8, color: '#444', marginTop: 2 }}>{selected.visual.carousel_id}</div>
                    )}
                  </div>
                )}
                {selected.visual.type === 'video_clip' && (
                  <div style={{ textAlign: 'center', color: '#555' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🎬</div>
                    <div style={{ fontSize: 10 }}>{selected.visual.source || 'No source'}</div>
                    <div style={{ fontSize: 8, color: '#444', marginTop: 2 }}>
                      {selected.visual.start ?? 0}s ~ {selected.visual.end ?? selected.duration_sec}s
                    </div>
                  </div>
                )}
                {selected.visual.type === 'image' && (
                  <div style={{ textAlign: 'center', color: '#555' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: 10 }}>{selected.visual.source || 'No image'}</div>
                  </div>
                )}
                {selected.visual.type === 'color' && (
                  <div style={{ textAlign: 'center', color: '#888' }}>
                    <div style={{ fontSize: 10 }}>{selected.visual.color || '#000000'}</div>
                  </div>
                )}
              </div>
              {/* Preview subtitle overlay */}
              {selected.subtitles.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: '#ccc', background: '#000000aa', padding: '4px 8px', borderRadius: 4 }}>
                  {selected.subtitles[0]?.text || ''}
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 9, color: '#555' }}>
                씬 {selected.scene_id} · {selected.duration_sec}s · {selected.transition.type}
              </div>
            </div>
          ) : (
            <div className="empty">씬을 선택하세요</div>
          )}
        </div>

        {/* ─── Right: Edit panel ─── */}
        <div style={{ width: 340, borderLeft: '1px solid #222', overflow: 'auto', flexShrink: 0 }}>
          {selected ? (
            <div style={{ padding: 12 }}>
              {/* ── Visual ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={sectionTitle}>비주얼</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Type</label>
                  <select
                    className="filter-select"
                    value={selected.visual.type}
                    onChange={(e) => {
                      const t = e.target.value as Visual['type']
                      const vis: Visual = { type: t }
                      if (t === 'carousel_slide') { vis.carousel_id = sb.carousel_id; vis.slide_index = 0 }
                      if (t === 'video_clip') { vis.source = ''; vis.start = 0; vis.end = selected.duration_sec }
                      if (t === 'image') { vis.source = '' }
                      if (t === 'color') { vis.color = '#000000' }
                      updateScene(selectedIdx, { visual: vis })
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="carousel_slide">Carousel Slide</option>
                    <option value="video_clip">Video Clip</option>
                    <option value="image">Image</option>
                    <option value="color">Color</option>
                  </select>
                </div>

                {/* Type-specific fields */}
                {selected.visual.type === 'carousel_slide' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lbl}>Carousel ID</label>
                      <input
                        className="filter-select"
                        value={selected.visual.carousel_id || ''}
                        onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, carousel_id: e.target.value || null } })}
                        placeholder={sb.carousel_id || 'carousel-xxx'}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={lbl}>Slide #</label>
                      <input
                        type="number" className="filter-select" min={0}
                        value={selected.visual.slide_index ?? 0}
                        onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, slide_index: parseInt(e.target.value) || 0 } })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}
                {selected.visual.type === 'video_clip' && (
                  <>
                    <div style={{ marginBottom: 8 }}>
                      <label style={lbl}>Source (파일명)</label>
                      <input
                        className="filter-select"
                        value={selected.visual.source || ''}
                        onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, source: e.target.value } })}
                        placeholder="video.mp4"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={lbl}>Start (초)</label>
                        <input
                          type="number" className="filter-select" min={0} step={0.1}
                          value={selected.visual.start ?? 0}
                          onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, start: parseFloat(e.target.value) || 0 } })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={lbl}>End (초)</label>
                        <input
                          type="number" className="filter-select" min={0} step={0.1}
                          value={selected.visual.end ?? selected.duration_sec}
                          onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, end: parseFloat(e.target.value) || 0 } })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </>
                )}
                {selected.visual.type === 'image' && (
                  <div>
                    <label style={lbl}>Image URL / 파일명</label>
                    <input
                      className="filter-select"
                      value={selected.visual.source || ''}
                      onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, source: e.target.value } })}
                      placeholder="https://... 또는 image.png"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {selected.visual.type === 'color' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={selected.visual.color || '#000000'}
                      onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, color: e.target.value } })}
                      style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                    <input
                      className="filter-select"
                      value={selected.visual.color || '#000000'}
                      onChange={(e) => updateScene(selectedIdx, { visual: { ...selected.visual, color: e.target.value } })}
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
              </div>

              {/* ── Time & Transition ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={sectionTitle}>시간</div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Duration: {selected.duration_sec}초</label>
                  <input
                    type="range" min={1} max={15} step={0.5}
                    value={selected.duration_sec}
                    onChange={(e) => updateScene(selectedIdx, { duration_sec: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: '#ff6b35' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={lbl}>Transition</label>
                    <select
                      className="filter-select"
                      value={selected.transition.type}
                      onChange={(e) => updateScene(selectedIdx, { transition: { ...selected.transition, type: e.target.value } })}
                      style={{ width: '100%' }}
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="fadeblack">Fade Black</option>
                      <option value="fadewhite">Fade White</option>
                      <option value="wipeleft">Wipe Left</option>
                      <option value="slideright">Slide Right</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Transition: {selected.transition.duration}초</label>
                    <input
                      type="range" min={0} max={2} step={0.1}
                      value={selected.transition.duration}
                      onChange={(e) => updateScene(selectedIdx, { transition: { ...selected.transition, duration: parseFloat(e.target.value) } })}
                      style={{ width: '100%', accentColor: '#2563eb' }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Camera ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={sectionTitle}>카메라</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Zoom Start: {selected.camera.zoom.start.toFixed(1)}</label>
                    <input
                      type="range" min={0.8} max={2.0} step={0.1}
                      value={selected.camera.zoom.start}
                      onChange={(e) => updateScene(selectedIdx, { camera: { ...selected.camera, zoom: { ...selected.camera.zoom, start: parseFloat(e.target.value) } } })}
                      style={{ width: '100%', accentColor: '#2563eb' }}
                    />
                  </div>
                  <div>
                    <label style={lbl}>Zoom End: {selected.camera.zoom.end.toFixed(1)}</label>
                    <input
                      type="range" min={0.8} max={2.0} step={0.1}
                      value={selected.camera.zoom.end}
                      onChange={(e) => updateScene(selectedIdx, { camera: { ...selected.camera, zoom: { ...selected.camera.zoom, end: parseFloat(e.target.value) } } })}
                      style={{ width: '100%', accentColor: '#2563eb' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Speed: {selected.camera.speed.toFixed(1)}x</label>
                  <input
                    type="range" min={0.5} max={2.0} step={0.1}
                    value={selected.camera.speed}
                    onChange={(e) => updateScene(selectedIdx, { camera: { ...selected.camera, speed: parseFloat(e.target.value) } })}
                    style={{ width: '100%', accentColor: '#2563eb' }}
                  />
                </div>
              </div>

              {/* ── Subtitles ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={sectionTitle}>자막 ({selected.subtitles.length})</div>
                  <button className="btn" onClick={() => addSubtitle(selectedIdx)} style={{ fontSize: 9, padding: '2px 6px' }}>+ 추가</button>
                </div>
                {selected.subtitles.map((sub, si) => (
                  <div key={si} style={{ background: '#141414', border: '1px solid #222', borderRadius: 4, padding: 8, marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: '#666' }}>#{si + 1}</span>
                      <button
                        onClick={() => removeSubtitle(selectedIdx, si)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 10 }}
                      >✕</button>
                    </div>
                    <textarea
                      className="notes-area"
                      value={sub.text}
                      onChange={(e) => updateSubtitle(selectedIdx, si, { text: e.target.value })}
                      placeholder="자막 텍스트..."
                      style={{ minHeight: 40, marginBottom: 6 }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div>
                        <label style={{ ...lbl, fontSize: 9 }}>Start Offset</label>
                        <input
                          type="number" className="filter-select" min={0} step={0.1}
                          value={sub.start_offset}
                          onChange={(e) => updateSubtitle(selectedIdx, si, { start_offset: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize: 9 }}>End Offset</label>
                        <input
                          type="number" className="filter-select" min={0} step={0.1}
                          value={sub.end_offset}
                          onChange={(e) => updateSubtitle(selectedIdx, si, { end_offset: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 60px', gap: 6, marginTop: 6 }}>
                      <div>
                        <label style={{ ...lbl, fontSize: 9 }}>Size</label>
                        <input
                          type="number" className="filter-select" min={8} max={72}
                          value={sub.style.size}
                          onChange={(e) => updateSubtitle(selectedIdx, si, { style: { ...sub.style, size: parseInt(e.target.value) || 18 } })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize: 9 }}>X</label>
                        <input
                          type="number" className="filter-select" min={0} max={100}
                          value={sub.style.x}
                          onChange={(e) => updateSubtitle(selectedIdx, si, { style: { ...sub.style, x: parseInt(e.target.value) || 50 } })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize: 9 }}>Y</label>
                        <input
                          type="number" className="filter-select" min={0} max={100}
                          value={sub.style.y}
                          onChange={(e) => updateSubtitle(selectedIdx, si, { style: { ...sub.style, y: parseInt(e.target.value) || 80 } })}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ ...lbl, fontSize: 9 }}>Color</label>
                        <input
                          type="color"
                          value={sub.style.color}
                          onChange={(e) => updateSubtitle(selectedIdx, si, { style: { ...sub.style, color: e.target.value } })}
                          style={{ width: '100%', height: 24, border: 'none', background: 'none', cursor: 'pointer' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Narration ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={sectionTitle}>나레이션</div>
                <textarea
                  className="notes-area"
                  value={selected.narration}
                  onChange={(e) => updateScene(selectedIdx, { narration: e.target.value })}
                  placeholder="나레이션 텍스트..."
                  style={{ minHeight: 80 }}
                />
              </div>

              {/* ── Scene actions ── */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn" onClick={() => duplicateScene(selectedIdx)} style={{ fontSize: 10 }}>
                  복제
                </button>
                <button className="btn btn-danger" onClick={() => removeScene(selectedIdx)} style={{ fontSize: 10 }}>
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="empty" style={{ padding: 20 }}>씬을 선택하세요</div>
          )}
        </div>
      </div>
    </div>
  )
}
