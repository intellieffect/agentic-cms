'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignEndHorizontal,
  AlignStartHorizontal,
  ChevronRight,
  Copy,
  Crop,
  Film,
  Maximize2,
  Move,
  RotateCcw,
  RotateCw,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';
import type { ClipZoom } from './types';

type SectionKey = 'speed' | 'crop' | 'zoom' | 'position' | 'audio' | 'align';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatShortTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getFileName = (source: string) => source.split('/').pop() || source;

interface InspectorSectionProps {
  id: SectionKey;
  icon: React.ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: (id: SectionKey) => void;
  children: React.ReactNode;
}

function InspectorSection({ id, icon, title, summary, open, onToggle, children }: InspectorSectionProps) {
  return (
    <section className="studio-inspector-section">
      <button className="studio-inspector-section-trigger" onClick={() => onToggle(id)} type="button">
        <span className="studio-inspector-section-title">
          {icon}
          {title}
        </span>
        <span className="studio-inspector-section-summary">
          {summary}
          <ChevronRight className={open ? 'is-open' : ''} size={15} />
        </span>
      </button>
      {open && <div className="studio-inspector-section-body">{children}</div>}
    </section>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step = 1, unit = '', onChange }: SliderRowProps) {
  return (
    <div className="studio-control-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="studio-value-pill">{value}{unit}</span>
    </div>
  );
}

export const ClipPanel: React.FC = () => {
  const selectedClipIndex = useEditorStore((s) => s.selectedClipIndex);
  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const clipCrops = useEditorStore((s) => s.clipCrops);
  const clipZooms = useEditorStore((s) => s.clipZooms);
  const updateClip = useEditorStore((s) => s.updateClip);
  const updateClipMeta = useEditorStore((s) => s.updateClipMeta);
  const setAllClipAudioMuted = useEditorStore((s) => s.setAllClipAudioMuted);
  const copyClipSettingsToAll = useEditorStore((s) => s.copyClipSettingsToAll);
  const updateClipCrop = useEditorStore((s) => s.updateClipCrop);
  const updateClipZoom = useEditorStore((s) => s.updateClipZoom);
  const splitClip = useEditorStore((s) => s.splitClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const replaceClipSource = useEditorStore((s) => s.replaceClipSource);
  const copyClip = useEditorStore((s) => s.copyClip);
  const paste = useEditorStore((s) => s.paste);
  const getProjectData = useEditorStore((s) => s.getProjectData);

  const [sourceDuration, setSourceDuration] = useState(0);
  const [splitTime, setSplitTime] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    speed: false,
    crop: false,
    zoom: false,
    position: false,
    audio: false,
    align: false,
  });
  const barRef = useRef<HTMLDivElement>(null);

  const clip = selectedClipIndex >= 0 && selectedClipIndex < clips.length ? clips[selectedClipIndex] : null;
  const meta = clip ? (clipMeta[selectedClipIndex] || { speed: 1 }) : { speed: 1 };
  const crop = clip ? (clipCrops[selectedClipIndex] || { x: 0, y: 0, w: 100, h: 100 }) : { x: 0, y: 0, w: 100, h: 100 };
  const zoom = clip ? (clipZooms[selectedClipIndex] || { scale: 1, panX: 0, panY: 0 }) : { scale: 1, panX: 0, panY: 0 };
  const opacity = meta.opacity ?? 100;
  const rotation = meta.rotation ?? 0;
  const clipVolume = meta.volume ?? 100;
  const isAudioMuted = meta.audioMuted ?? false;
  const allClipAudioMuted = clips.length > 0 && clips.every((_, i) => clipMeta[i]?.audioMuted ?? false);
  const fitMode = meta.fitMode ?? 'cover';
  const posX = meta.positionX ?? 50;
  const posY = meta.positionY ?? 50;

  useEffect(() => {
    if (!clip) return;
    // probe는 source(파일)에만 의존 — clip.end는 첫 응답 실패 시 fallback에만 쓰이므로
    // deps에 넣으면 trim drag 매 프레임마다 fetch가 fire됨 (네트워크 폭격).
    const fallback = clip.end + 10;
    fetch(`${getEditorConfig().apiUrl}/api/media/probe/${encodeURIComponent(clip.source)}`)
      .then((r) => r.json())
      .then((d) => setSourceDuration(d.duration || fallback))
      .catch(() => setSourceDuration(fallback));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.source]);

  // 저장 후 사용자가 클립을 다시 수정하면 status pill을 "대기"로 되돌려서
  // "이미 저장됨"이 아닌 "변경 있음" 상태임을 시각적으로 알린다.
  useEffect(() => {
    setSaveStatus((prev) => (prev === 'saved' || prev === 'failed' ? 'idle' : prev));
  }, [clips, clipMeta, clipCrops, clipZooms]);

  if (!clip) {
    return (
      <div className="studio-inspector-empty">
        <Film size={22} />
        <strong>클립을 선택하세요</strong>
        <span>타임라인에서 비디오 클립을 선택하면 속성 패널이 표시됩니다.</span>
      </div>
    );
  }

  const clipDuration = (clip.end - clip.start) / meta.speed;
  const barTotal = sourceDuration || clip.end + 5;
  const barStartPct = (clip.start / barTotal) * 100;
  const barWidthPct = ((clip.end - clip.start) / barTotal) * 100;
  const splitAt = splitTime ?? Number(((clip.start + clip.end) / 2).toFixed(1));

  const toggleSection = (id: SectionKey) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleBarMouseDown = (e: React.MouseEvent, type: 'left' | 'right' | 'move') => {
    e.preventDefault();
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const startX = e.clientX;
    const origStart = clip.start;
    const origEnd = clip.end;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dt = (dx / rect.width) * barTotal;
      if (type === 'left') {
        updateClip(selectedClipIndex, { start: clamp(origStart + dt, 0, origEnd - 0.1) });
      } else if (type === 'right') {
        updateClip(selectedClipIndex, { end: clamp(origEnd + dt, origStart + 0.1, barTotal) });
      } else {
        const dur = origEnd - origStart;
        const newStart = clamp(origStart + dt, 0, barTotal - dur);
        updateClip(selectedClipIndex, { start: newStart, end: newStart + dur });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleReplaceSource = async () => {
    try {
      const r = await fetch(`${getEditorConfig().apiUrl}/api/resolver/pick-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: '영상' }),
      });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.filepath) return;
      const fname = d.filepath.split('/').pop() || 'video.mp4';
      await fetch(`${getEditorConfig().apiUrl}/api/resolver/link-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fname, filepath: d.filepath }),
      });
      let duration = 10;
      try {
        const pr = await fetch(`${getEditorConfig().apiUrl}/api/media/probe/${encodeURIComponent(fname)}`);
        if (pr.ok) {
          const pd = await pr.json();
          duration = pd.duration || 10;
        }
      } catch {}
      replaceClipSource(selectedClipIndex, fname, duration);
    } catch {}
  };

  const duplicateSelectedClip = () => {
    copyClip();
    paste();
  };

  const resetSelectedClip = () => {
    updateClipMeta(selectedClipIndex, { speed: 1, opacity: 100, rotation: 0, volume: 100, audioMuted: false, fitMode: 'cover', positionX: 50, positionY: 50 });
    updateClipCrop(selectedClipIndex, { x: 0, y: 0, w: 100, h: 100 });
    updateClipZoom(selectedClipIndex, { scale: 1, panX: 0, panY: 0, animation: 'none', scaleEnd: undefined, panXEnd: undefined, panYEnd: undefined });
  };

  const saveProject = async () => {
    setSaveStatus('saving');
    try {
      const r = await fetch(`${getEditorConfig().apiUrl}/api/projects/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getProjectData()),
      });
      setSaveStatus(r.ok ? 'saved' : 'failed');
    } catch {
      setSaveStatus('failed');
    }
  };

  return (
    <div className="studio-inspector-shell">
      <div className="studio-inspector-scroll">
        <section className="studio-clip-hero-card">
          <div className="studio-clip-icon"><Film size={28} /></div>
          <div className="studio-clip-title-block">
            <span>클립 {selectedClipIndex + 1} / {clips.length}</span>
            <strong title={clip.source}>{getFileName(clip.source)}</strong>
          </div>
          <span className="studio-duration-badge">{clipDuration.toFixed(1)}s</span>
          <button className="studio-icon-button studio-button-blue" onClick={handleReplaceSource} type="button">변경</button>
          <button className="studio-icon-button studio-button-danger" onClick={() => removeClip(selectedClipIndex)} type="button" aria-label="클립 삭제">
            <Trash2 size={15} />
          </button>
        </section>

        <section className="studio-card">
          <h3>빠른 작업</h3>
          <div className="studio-action-grid">
            <button type="button" onClick={() => splitClip(selectedClipIndex, splitAt)}><Scissors size={15} />분할</button>
            <button type="button" onClick={duplicateSelectedClip}><Copy size={15} />복제</button>
            <button type="button" onClick={() => updateClipMeta(selectedClipIndex, { audioMuted: !isAudioMuted })}>{isAudioMuted ? <Volume2 size={15} /> : <VolumeX size={15} />}{isAudioMuted ? '오디오 켜기' : '오디오 끄기'}</button>
            <button type="button" onClick={resetSelectedClip}><RotateCcw size={15} />리셋</button>
          </div>
        </section>

        <section className="studio-card studio-trim-card">
          <h3>구간 편집</h3>
          <div className="studio-time-grid">
            <label>
              <span>시작</span>
              <input type="number" min={0} max={clip.end - 0.1} step={0.1} value={Number(clip.start.toFixed(1))} onChange={(e) => updateClip(selectedClipIndex, { start: clamp(Number(e.target.value), 0, clip.end - 0.1) })} />
            </label>
            <span className="studio-link-mark">⌁</span>
            <label>
              <span>종료</span>
              <input type="number" min={clip.start + 0.1} step={0.1} value={Number(clip.end.toFixed(1))} onChange={(e) => updateClip(selectedClipIndex, { end: Math.max(clip.start + 0.1, Number(e.target.value)) })} />
            </label>
          </div>
          <div className="studio-waveform-bar" ref={barRef}>
            <div className="studio-waveform-texture" />
            <div className="studio-trim-selection" onMouseDown={(e) => handleBarMouseDown(e, 'move')} style={{ left: `${barStartPct}%`, width: `${barWidthPct}%` }}>
              <span onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, 'left'); }} />
              <span onMouseDown={(e) => { e.stopPropagation(); handleBarMouseDown(e, 'right'); }} />
            </div>
          </div>
          <div className="studio-time-footer">
            <span>{formatShortTime(clip.start)}</span>
            <span className="studio-speed-chip">{meta.speed}x</span>
            <span>{formatShortTime(sourceDuration)}</span>
          </div>
          <div className="studio-split-row">
            <label>분할 지점</label>
            <input type="number" min={clip.start + 0.1} max={clip.end - 0.1} step={0.1} value={splitAt} onChange={(e) => setSplitTime(Number(e.target.value))} />
            <button type="button" onClick={() => { splitClip(selectedClipIndex, splitAt); setSplitTime(null); }}>분할</button>
          </div>
        </section>

        <section className="studio-card studio-transform-card">
          <h3>변형 (Transform)</h3>
          <div className="studio-transform-grid">
            <div className="studio-transform-group">
              <div className="studio-transform-heading"><Move size={14} />위치</div>
              <div className="studio-mini-fields">
                <label>X<input type="number" value={posX} onChange={(e) => updateClipMeta(selectedClipIndex, { positionX: clamp(Number(e.target.value), 0, 100) })} /></label>
                <label>Y<input type="number" value={posY} onChange={(e) => updateClipMeta(selectedClipIndex, { positionY: clamp(Number(e.target.value), 0, 100) })} /></label>
                <button type="button" onClick={() => updateClipMeta(selectedClipIndex, { positionX: 50, positionY: 50 })}><RotateCcw size={13} /></button>
              </div>
              <input type="range" min={0} max={100} value={posX} onChange={(e) => updateClipMeta(selectedClipIndex, { positionX: Number(e.target.value) })} />
            </div>
            <div className="studio-transform-group">
              <div className="studio-transform-heading"><RotateCw size={14} />회전</div>
              <div className="studio-mini-fields">
                <label><input type="number" min={-360} max={360} value={rotation} onChange={(e) => updateClipMeta(selectedClipIndex, { rotation: clamp(Number(e.target.value), -360, 360) })} />°</label>
                <button type="button" onClick={() => updateClipMeta(selectedClipIndex, { rotation: 0 })}><RotateCcw size={13} /></button>
              </div>
              <input type="range" min={-360} max={360} value={rotation} onChange={(e) => updateClipMeta(selectedClipIndex, { rotation: Number(e.target.value) })} />
            </div>
            <div className="studio-transform-group">
              <div className="studio-transform-heading"><Maximize2 size={14} />크기</div>
              <div className="studio-mini-fields">
                <label><input type="number" min={50} max={300} value={Number((zoom.scale * 100).toFixed(0))} onChange={(e) => updateClipZoom(selectedClipIndex, { scale: clamp(Number(e.target.value) / 100, 0.5, 3) })} />%</label>
                <button type="button" onClick={() => updateClipZoom(selectedClipIndex, { scale: 1 })}><RotateCcw size={13} /></button>
              </div>
              <input type="range" min={0.5} max={3} step={0.1} value={zoom.scale} onChange={(e) => updateClipZoom(selectedClipIndex, { scale: Number(e.target.value) })} />
            </div>
            <div className="studio-transform-group">
              <div className="studio-transform-heading"><SlidersHorizontal size={14} />불투명도</div>
              <div className="studio-mini-fields"><label><input type="number" value={opacity} onChange={(e) => updateClipMeta(selectedClipIndex, { opacity: clamp(Number(e.target.value), 0, 100) })} />%</label></div>
              <input type="range" min={0} max={100} value={opacity} onChange={(e) => updateClipMeta(selectedClipIndex, { opacity: Number(e.target.value) })} />
            </div>
          </div>
        </section>

        <div className="studio-section-stack">
          <InspectorSection id="speed" icon={<Zap size={15} />} title="속도" summary={`${meta.speed}x`} open={openSections.speed} onToggle={toggleSection}>
            <div className="studio-stepper-row">
              <button onClick={() => updateClipMeta(selectedClipIndex, { speed: Math.max(0.25, meta.speed - 0.25) })}>−</button>
              <strong>{meta.speed}x</strong>
              <button onClick={() => updateClipMeta(selectedClipIndex, { speed: Math.min(4, meta.speed + 0.25) })}>+</button>
              <button onClick={() => updateClipMeta(selectedClipIndex, { speed: 1 })}>기본값</button>
            </div>
          </InspectorSection>

          <InspectorSection id="crop" icon={<Crop size={15} />} title="크롭" summary={crop.w === 100 && crop.h === 100 ? '없음' : `${crop.w}×${crop.h}%`} open={openSections.crop} onToggle={toggleSection}>
            <div className="studio-crop-grid">
              {(['x', 'y', 'w', 'h'] as const).map((key) => (
                <SliderRow key={key} label={key.toUpperCase()} min={0} max={100} value={crop[key]} unit="%" onChange={(value) => updateClipCrop(selectedClipIndex, { [key]: value })} />
              ))}
            </div>
          </InspectorSection>

          <InspectorSection id="zoom" icon={<Maximize2 size={15} />} title="줌 애니메이션" summary={zoom.animation && zoom.animation !== 'none' ? zoom.animation : '없음'} open={openSections.zoom} onToggle={toggleSection}>
            <select className="studio-select" value={zoom.animation || 'none'} onChange={(e) => updateClipZoom(selectedClipIndex, { animation: e.target.value as ClipZoom['animation'] })}>
              <option value="none">없음 (정적)</option>
              <option value="zoomIn">줌 인</option>
              <option value="zoomOut">줌 아웃</option>
              <option value="panLeft">팬 왼쪽</option>
              <option value="panRight">팬 오른쪽</option>
              <option value="panUp">팬 위</option>
              <option value="panDown">팬 아래</option>
              <option value="custom">커스텀</option>
            </select>
            <SliderRow label="Scale" min={0.5} max={3} step={0.1} value={Number(zoom.scale.toFixed(1))} onChange={(value) => updateClipZoom(selectedClipIndex, { scale: value })} />
            <SliderRow label="Pan X" min={-50} max={50} value={zoom.panX} unit="%" onChange={(value) => updateClipZoom(selectedClipIndex, { panX: value })} />
            <SliderRow label="Pan Y" min={-50} max={50} value={zoom.panY} unit="%" onChange={(value) => updateClipZoom(selectedClipIndex, { panY: value })} />
          </InspectorSection>

          <InspectorSection id="position" icon={<Move size={15} />} title="영상 위치" summary={fitMode === 'contain' ? '가로 맞춤' : '세로 채우기'} open={openSections.position} onToggle={toggleSection}>
            <div className="studio-segmented">
              <button className={fitMode === 'cover' ? 'is-active' : ''} onClick={() => updateClipMeta(selectedClipIndex, { fitMode: 'cover', positionX: 50, positionY: 50 })}>세로 채우기</button>
              <button className={fitMode === 'contain' ? 'is-active' : ''} onClick={() => updateClipMeta(selectedClipIndex, { fitMode: 'contain', positionX: 50, positionY: 50 })}>가로 맞춤</button>
            </div>
            <SliderRow label="좌우" min={0} max={100} value={posX} unit="%" onChange={(value) => updateClipMeta(selectedClipIndex, { positionX: value })} />
            <SliderRow label="상하" min={0} max={100} value={posY} unit="%" onChange={(value) => updateClipMeta(selectedClipIndex, { positionY: value })} />
          </InspectorSection>

          <InspectorSection id="audio" icon={isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />} title="영상 소리" summary={isAudioMuted ? '꺼짐' : `켜짐 ${clipVolume}%`} open={openSections.audio} onToggle={toggleSection}>
            <div className="studio-segmented">
              <button className={!isAudioMuted ? 'is-active' : ''} onClick={() => updateClipMeta(selectedClipIndex, { audioMuted: false })}>켜짐</button>
              <button className={isAudioMuted ? 'is-active' : ''} onClick={() => updateClipMeta(selectedClipIndex, { audioMuted: true })}>음소거</button>
            </div>
            <SliderRow label="볼륨" min={0} max={100} value={clipVolume} unit="%" onChange={(value) => updateClipMeta(selectedClipIndex, { volume: value, audioMuted: false })} />
            <div className="studio-segmented">
              <button className={allClipAudioMuted ? 'is-active' : ''} onClick={() => setAllClipAudioMuted(true)}>전체 음소거</button>
              <button className={!allClipAudioMuted ? 'is-active' : ''} onClick={() => setAllClipAudioMuted(false)}>전체 켜기</button>
            </div>
          </InspectorSection>

          <InspectorSection id="align" icon={<AlignCenter size={15} />} title="정렬" summary={zoom.panX < -1 ? '왼쪽' : zoom.panX > 1 ? '오른쪽' : '가운데'} open={openSections.align} onToggle={toggleSection}>
            <div className="studio-align-row">
              <button onClick={() => updateClipZoom(selectedClipIndex, { panX: -50 + (50 / zoom.scale) })}><AlignStartHorizontal size={16} />왼쪽</button>
              <button onClick={() => updateClipZoom(selectedClipIndex, { panX: 0, panY: 0 })}><AlignCenter size={16} />중앙</button>
              <button onClick={() => updateClipZoom(selectedClipIndex, { panX: 50 - (50 / zoom.scale) })}><AlignEndHorizontal size={16} />오른쪽</button>
            </div>
          </InspectorSection>
        </div>
      </div>

      <div className="studio-inspector-footer">
        <button className="studio-primary-action" type="button" onClick={saveProject}>프로젝트 저장</button>
        <button className="studio-secondary-action" type="button" onClick={() => copyClipSettingsToAll(selectedClipIndex)}>전체 클립에 복사</button>
        <span className={`studio-save-status is-${saveStatus}`}>
          <span />
          {saveStatus === 'saving' ? '저장 중' : saveStatus === 'failed' ? '실패' : saveStatus === 'saved' ? '저장됨' : '대기'}
        </span>
      </div>
    </div>
  );
};
