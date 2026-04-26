'use client';

import React, { useState } from 'react';
import { getEditorConfig } from '@/lib/editor-config';
import { useEditorStore } from './store';
import type { SubtitleEffect } from './remotion-types';

const EFFECTS: { value: SubtitleEffect; label: string; desc?: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'typewriter', label: '타이핑', desc: '한 글자씩 나타남' },
  { value: 'slideUp', label: '슬라이드', desc: '아래에서 위로' },
  { value: 'fadeIn', label: '페이드', desc: '투명→불투명' },
  { value: 'wordHighlight', label: '단어 하이라이트', desc: '현재 단어 색상 변경' },
  { value: 'wordScale', label: '단어 스케일', desc: '현재 단어 확대 효과' },
  { value: 'wordBoxMove', label: '이동 배경', desc: '배경 박스가 단어 따라 이동' },
];

const FONT_GROUPS = [
  { group: '고딕 (sans-serif)', fonts: [
    { value: "'Apple SD Gothic Neo',sans-serif", label: 'Apple SD 고딕' },
    { value: "'Noto Sans KR',sans-serif", label: 'Noto Sans KR' },
    { value: "'Pretendard',sans-serif", label: '프리텐다드' },
    { value: "'GmarketSans',sans-serif", label: 'G마켓 산스' },
    { value: "'SUITE',sans-serif", label: 'SUITE' },
    { value: "'Paperlogy',sans-serif", label: '페이퍼로지' },
    { value: "'LINESeedKR',sans-serif", label: 'LINE Seed' },
    { value: "'ONE Mobile OTF',sans-serif", label: 'ONE 모바일고딕' },
    { value: "'HDharmony',sans-serif", label: '현대하모니' },
  ]},
  { group: '강조/임팩트', fonts: [
    { value: "'BMDOHYEON',sans-serif", label: '배민 도현체' },
    { value: "'BMHANNAPro',sans-serif", label: '배민 한나Pro' },
    { value: "'BMJUA',sans-serif", label: '배민 주아체' },
    { value: "'Jalnan',sans-serif", label: '잘난체' },
    { value: "'CookieRun',sans-serif", label: '쿠키런' },
    { value: "'Cafe24 Ssurround',sans-serif", label: '카페24 써라운드' },
    { value: "'Cafe24 Ssurround Air',sans-serif", label: '카페24 써라운드Air' },
    { value: "'Moneygraphy',sans-serif", label: '머니그라피' },
  ]},
  { group: '명조/바탕 (serif)', fonts: [
    { value: "'AppleMyungjo',serif", label: '명조체' },
    { value: "'Gowun Batang',serif", label: '고운바탕' },
    { value: "'MaruBuri',serif", label: '마루부리' },
    { value: "'Batang',serif", label: '바탕' },
  ]},
  { group: '손글씨/감성', fonts: [
    { value: "'HSYuji',sans-serif", label: 'HS유지체' },
    { value: "'MapoBackpacking',sans-serif", label: '마포 배낭여행' },
    { value: "'MapoPeacefull',sans-serif", label: '마포 평화' },
    { value: "'MapoDPP',sans-serif", label: '마포 꽃' },
    { value: "'양진체',sans-serif", label: '양진체' },
    { value: "'Binggrae',sans-serif", label: '빙그레체' },
    { value: "'Binggrae Samanco',sans-serif", label: '빙그레 싸만코' },
    { value: "'SANGJU Gotgam',sans-serif", label: '상주곶감체' },
    { value: "'SANGJU Dajungdagam',sans-serif", label: '상주다정다감' },
    { value: "'SANGJU Gyeongcheon Island',sans-serif", label: '상주경천섬' },
    { value: "'RecipekoreaOTF',sans-serif", label: '레시피코리아' },
    { value: "'MBC 1961 OTF',sans-serif", label: 'MBC 1961' },
  ]},
  { group: '영문 손글씨', fonts: [
    { value: "'Coming Soon',cursive", label: 'Coming Soon' },
    { value: "'Indie Flower',cursive", label: 'Indie Flower' },
    { value: "'Caveat',cursive", label: 'Caveat' },
  ]},
  { group: '영문', fonts: [
    { value: "Arial,Helvetica,sans-serif", label: 'Arial' },
    { value: "'Courier New',monospace", label: 'Courier New' },
    { value: "Georgia,serif", label: 'Georgia' },
    { value: "Impact,sans-serif", label: 'Impact' },
    { value: "'Montserrat',sans-serif", label: 'Montserrat' },
    { value: "'Jost',sans-serif", label: 'Jost' },
    { value: "'Nunito',sans-serif", label: 'Nunito' },
    { value: "'Inter',sans-serif", label: 'Inter' },
    { value: "'Oswald',sans-serif", label: 'Oswald' },
    { value: "'Anton',sans-serif", label: 'Anton' },
    { value: "'Bebas Neue',sans-serif", label: 'Bebas Neue' },
  ]},
];

export const SubtitlePanel: React.FC = () => {
  const selectedSubIndex = useEditorStore((s) => s.selectedSubIndex);
  const globalSubs = useEditorStore((s) => s.globalSubs);
  const updateGlobalSub = useEditorStore((s) => s.updateGlobalSub);
  const addSubtitle = useEditorStore((s) => s.addSubtitle);
  const removeSubtitle = useEditorStore((s) => s.removeSubtitle);
  const setSelectedSubIndex = useEditorStore((s) => s.setSelectedSubIndex);
  const currentFrame = useEditorStore((s) => s.currentFrame);

  const clips = useEditorStore((s) => s.clips);
  const clipMeta = useEditorStore((s) => s.clipMeta);
  const [whisperLoading, setWhisperLoading] = useState(false);

  const handleWhisperGenerate = async () => {
    if (clips.length === 0) { alert('영상 클립이 없습니다'); return; }
    setWhisperLoading(true);
    try {
      // Calculate timeline positions for each clip
      let cursor = 0;
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const speed = clipMeta[i]?.speed ?? 1;
        const clipDur = (clip.end - clip.start) / speed;

        const r = await fetch(`${getEditorConfig().apiUrl}/api/whisper/transcribe-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: clip.source,
            language: 'auto',
            model: 'base',
            timeOffset: cursor,
          }),
        });

        if (r.ok) {
          const data = await r.json();
          const subs = data.subtitles || [];
          for (const sub of subs) {
            addSubtitle({
              text: sub.text,
              start: sub.start,
              end: sub.end,
              style: {
                size: 16,
                x: 50,
                y: 85,
                color: '#FFFFFF',
                font: "'BMDOHYEON',sans-serif",
                bg: true,
                bgColor: '#000000',
                bgAlpha: 0.6,
              },
              effect: 'fadeIn',
            });
          }
        }
        cursor += clipDur;
      }
    } catch (e) {
      alert('자막 생성 실패: ' + (e instanceof Error ? e.message : e));
    }
    setWhisperLoading(false);
  };

  const handleAdd = () => {
    const currentTime = currentFrame / 30;
    addSubtitle({
      text: '새 자막',
      start: currentTime,
      end: currentTime + 2,
      style: {
        size: 16,
        x: 50,
        y: 80,
        color: '#FFFFFF',
        font: "'BMDOHYEON',sans-serif",
        bg: true,
        bgColor: '#000000',
        bgAlpha: 0.6,
        lineHeight: 1.2,
        textAlign: 'center',
      },
      effect: 'fadeIn',
    });
  };

  const handleDelete = () => {
    if (selectedSubIndex >= 0) {
      removeSubtitle(selectedSubIndex);
    }
  };

  return (
    <div className="studio-panel-content studio-panel-content-subtitle" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header with add/delete */}
      <div className="studio-panel-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
          자막 ({globalSubs.length})
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="be-btn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={handleAdd}>+ 추가</button>
          <button
            className="be-btn"
            style={{ fontSize: 9, padding: '2px 6px', color: '#a78bfa', borderColor: '#a78bfa44' }}
            onClick={handleWhisperGenerate}
            disabled={whisperLoading}
          >
            {whisperLoading ? '생성 중...' : '🎤 자동 생성'}
          </button>
          {selectedSubIndex >= 0 && (
            <button
              className="be-btn"
              style={{ fontSize: 9, padding: '2px 6px', color: '#ef4444', borderColor: '#ef444444' }}
              onClick={handleDelete}
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* Subtitle list */}
      {globalSubs.length > 0 && (
        <div className="studio-card studio-subtitle-list" style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 250, overflow: 'auto' }}>
          {globalSubs
            .map((sub, i) => ({ sub, i }))
            .sort((a, b) => a.sub.start - b.sub.start)
            .map(({ sub, i }) => (
            <div
              className="studio-subtitle-list-item"
              key={i}
              onClick={() => setSelectedSubIndex(i)}
              style={{
                padding: '4px 6px',
                background: selectedSubIndex === i ? '#7c3aed22' : '#1a1a1a',
                border: selectedSubIndex === i ? '1px solid #7c3aed' : '1px solid #2a2a2a',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 10,
                color: '#ccc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span style={{ color: '#555', marginRight: 4 }}>{sub.start.toFixed(1)}s</span>
              {sub.text}
            </div>
          ))}
        </div>
      )}

      {selectedSubIndex < 0 || selectedSubIndex >= globalSubs.length ? (
        <div className="studio-card" style={{ color: '#555', fontSize: 11 }}>
          자막을 선택하거나 추가하세요
        </div>
      ) : (
        <SubEditor index={selectedSubIndex} />
      )}
    </div>
  );
};

const SubEditor: React.FC<{ index: number }> = ({ index }) => {
  const sub = useEditorStore((s) => s.globalSubs[index]);
  const updateGlobalSub = useEditorStore((s) => s.updateGlobalSub);

  if (!sub) return null;
  const style = sub.style || {};

  return (
    <div className="studio-panel-subeditor">
      {/* Time inputs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: '#666' }}>시작 (s)</label>
          <input
            type="number"
            step={0.1}
            min={0}
            value={sub.start}
            onChange={(e) => updateGlobalSub(index, { start: Number(e.target.value) })}
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 4, color: '#ccc', padding: '4px 6px', fontSize: 11,
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: '#666' }}>끝 (s)</label>
          <input
            type="number"
            step={0.1}
            min={0}
            value={sub.end}
            onChange={(e) => updateGlobalSub(index, { end: Number(e.target.value) })}
            style={{
              width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a',
              borderRadius: 4, color: '#ccc', padding: '4px 6px', fontSize: 11,
            }}
          />
        </div>
      </div>

      {/* Text */}
      <label style={{ fontSize: 9, color: '#666' }}>텍스트</label>
      <textarea
        value={sub.text}
        onChange={(e) => updateGlobalSub(index, { text: e.target.value })}
        rows={3}
        style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderRadius: 4,
          color: '#ccc',
          padding: '6px 8px',
          fontSize: 12,
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />

      {/* Effect */}
      <label style={{ fontSize: 9, color: '#666' }}>이펙트</label>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {EFFECTS.map((ef) => (
          <button
            key={ef.value}
            className={`be-btn ${sub.effect === ef.value || (!sub.effect && ef.value === 'fadeIn') ? 'be-btn-on' : ''}`}
            onClick={() => updateGlobalSub(index, { effect: ef.value })}
            style={{ fontSize: 10 }}
          >
            {ef.label}
          </button>
        ))}
      </div>

      {/* Font */}
      <label style={{ fontSize: 9, color: '#666' }}>폰트</label>
      <select
        value={style.font || "'BMDOHYEON',sans-serif"}
        onChange={(e) => updateGlobalSub(index, { style: { ...style, font: e.target.value } })}
        className="filter-select"
        style={{ width: '100%' }}
      >
        {FONT_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.fonts.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Size */}
      <label style={{ fontSize: 9, color: '#666' }}>크기: {style.size ?? 16}px</label>
      <input
        type="range"
        min={8}
        max={100}
        value={style.size ?? 16}
        onChange={(e) => updateGlobalSub(index, { style: { ...style, size: Number(e.target.value) } })}
        style={{ width: '100%', accentColor: '#2563eb' }}
      />

      {/* Color */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 9, color: '#666' }}>색상</label>
        <input
          type="color"
          value={style.color || '#FFFFFF'}
          onChange={(e) => updateGlobalSub(index, { style: { ...style, color: e.target.value } })}
          style={{ width: 28, height: 20, border: 'none', background: 'none', cursor: 'pointer' }}
        />
      </div>

      {/* Highlight Color (for word effects) */}
      {(sub.effect === 'wordHighlight' || sub.effect === 'wordScale' || sub.effect === 'wordBoxMove') && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 9, color: '#666' }}>하이라이트 색상</label>
          <input
            type="color"
            value={style.highlightColor || '#FFD700'}
            onChange={(e) => updateGlobalSub(index, { style: { ...style, highlightColor: e.target.value } })}
            style={{ width: 28, height: 20, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', gap: 2 }}>
            {['#FFD700', '#FF4444', '#00FF88', '#4488FF', '#FF66FF'].map((c) => (
              <div
                key={c}
                onClick={() => updateGlobalSub(index, { style: { ...style, highlightColor: c } })}
                style={{
                  width: 16, height: 16, borderRadius: 3, background: c, cursor: 'pointer',
                  border: (style.highlightColor || '#FFD700') === c ? '2px solid #fff' : '1px solid #333',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Text Align */}
      <label style={{ fontSize: 9, color: '#666' }}>텍스트 정렬</label>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { value: 'left', label: '좌' },
          { value: 'center', label: '중' },
          { value: 'right', label: '우' },
        ].map((a) => (
          <button
            key={a.value}
            className={`be-btn ${(style.textAlign || 'center') === a.value ? 'be-btn-on' : ''}`}
            onClick={() => updateGlobalSub(index, { style: { ...style, textAlign: a.value } })}
            style={{ fontSize: 10, flex: 1 }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Line Height */}
      <label style={{ fontSize: 9, color: '#666' }}>행간: {Math.round((style.lineHeight ?? 1.4) * 100)}%</label>
      <input
        type="range"
        min={80}
        max={250}
        value={Math.round((style.lineHeight ?? 1.4) * 100)}
        onChange={(e) => updateGlobalSub(index, { style: { ...style, lineHeight: Number(e.target.value) / 100 } })}
        style={{ width: '100%', accentColor: '#2563eb' }}
      />

      {/* Background */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 9, color: '#666' }}>배경</label>
        <button
          className={`be-btn ${style.bg !== false ? 'be-btn-on' : ''}`}
          onClick={() => updateGlobalSub(index, { style: { ...style, bg: !(style.bg !== false) } })}
          style={{ fontSize: 9 }}
        >
          {style.bg !== false ? 'ON' : 'OFF'}
        </button>
        {style.bg !== false && (
          <>
            <input
              type="color"
              value={style.bgColor || '#000000'}
              onChange={(e) => updateGlobalSub(index, { style: { ...style, bgColor: e.target.value } })}
              style={{ width: 28, height: 20, border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((style.bgAlpha ?? 0.6) * 100)}
              onChange={(e) => updateGlobalSub(index, { style: { ...style, bgAlpha: Number(e.target.value) / 100 } })}
              style={{ width: 60, accentColor: '#2563eb' }}
            />
            <span style={{ fontSize: 8, color: '#555' }}>{Math.round((style.bgAlpha ?? 0.6) * 100)}%</span>
          </>
        )}
      </div>

      {/* Position + 정렬 버튼 */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: 9, color: '#666', marginRight: 'auto' }}>위치</label>
        <button
          onClick={() => updateGlobalSub(index, { style: { ...style, x: 50 } })}
          title="가로 가운데"
          style={{ background: (style.x ?? 50) === 50 ? '#2563eb33' : '#222', border: '1px solid #444', color: '#ddd', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9 }}
        >↔ 가운데</button>
        <button
          onClick={() => updateGlobalSub(index, { style: { ...style, y: 50 } })}
          title="세로 가운데"
          style={{ background: (style.y ?? 80) === 50 ? '#2563eb33' : '#222', border: '1px solid #444', color: '#ddd', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9 }}
        >↕ 가운데</button>
        <button
          onClick={() => updateGlobalSub(index, { style: { ...style, x: 50, y: 50 } })}
          title="정중앙"
          style={{ background: (style.x ?? 50) === 50 && (style.y ?? 80) === 50 ? '#2563eb33' : '#222', border: '1px solid #444', color: '#ddd', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 9 }}
        >⊕ 정중앙</button>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: '#666' }}>X: {style.x ?? 50}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={style.x ?? 50}
            onChange={(e) => updateGlobalSub(index, { style: { ...style, x: Number(e.target.value) } })}
            style={{ width: '100%', accentColor: '#2563eb' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, color: '#666' }}>Y: {style.y ?? 80}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={style.y ?? 80}
            onChange={(e) => updateGlobalSub(index, { style: { ...style, y: Number(e.target.value) } })}
            style={{ width: '100%', accentColor: '#2563eb' }}
          />
        </div>
      </div>
    </div>
  );
};
