'use client';

import React from 'react';
import { useEditorStore } from './store';

const TRANSITION_TYPES = [
  { value: 'none', label: '없음' },
  { value: 'fade', label: 'Fade (크로스페이드)' },
  { value: 'fadeblack', label: 'Fade Black' },
  { value: 'wipeleft', label: 'Wipe ←' },
  { value: 'wiperight', label: 'Wipe →' },
  { value: 'wipeup', label: 'Wipe ↑' },
  { value: 'wipedown', label: 'Wipe ↓' },
  { value: 'slideleft', label: 'Slide ←' },
  { value: 'slideright', label: 'Slide →' },
  { value: 'slideup', label: 'Slide ↑' },
  { value: 'slidedown', label: 'Slide ↓' },
  { value: 'cubeleft', label: '3D Cube ←' },
  { value: 'cuberight', label: '3D Cube →' },
  { value: 'cubeup', label: '3D Cube ↑' },
  { value: 'cubedown', label: '3D Cube ↓' },
];

export const TransitionPanel: React.FC = () => {
  const clips = useEditorStore((s) => s.clips);
  const transitions = useEditorStore((s) => s.transitions);
  const selectedClipIndex = useEditorStore((s) => s.selectedClipIndex);
  const setTransition = useEditorStore((s) => s.setTransition);
  const fadeInOut = useEditorStore((s) => s.fadeInOut);
  const updateFadeInOut = useEditorStore((s) => s.updateFadeInOut);

  // Show transition for the gap after selectedClipIndex (or all if none selected)
  const transitionIndices: number[] = [];
  if (clips.length >= 2) {
    if (selectedClipIndex >= 0 && selectedClipIndex < clips.length - 1) {
      transitionIndices.push(selectedClipIndex);
    } else {
      for (let i = 0; i < clips.length - 1; i++) {
        transitionIndices.push(i);
      }
    }
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Fade In/Out */}
      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
        페이드 인/아웃
      </div>
      <div style={{ padding: 8, background: '#1a1a1a', borderRadius: 6, border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`btn ${fadeInOut.enabled ? 'btn-on' : ''}`}
            onClick={() => updateFadeInOut({ enabled: !fadeInOut.enabled })}
            style={{ fontSize: 9 }}
          >
            {fadeInOut.enabled ? 'ON' : 'OFF'}
          </button>
          <span style={{ fontSize: 10, color: '#888' }}>전체 영상 페이드 효과</span>
        </div>
        {fadeInOut.enabled && (
          <>
            <div>
              <label style={{ fontSize: 9, color: '#666' }}>Fade In: {(fadeInOut.fadeInDuration ?? 0.5).toFixed(1)}s</label>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={fadeInOut.fadeInDuration}
                onChange={(e) => updateFadeInOut({ fadeInDuration: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 9, color: '#666' }}>Fade Out: {(fadeInOut.fadeOutDuration ?? 0.5).toFixed(1)}s</label>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={fadeInOut.fadeOutDuration}
                onChange={(e) => updateFadeInOut({ fadeOutDuration: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#7c3aed' }}
              />
            </div>
          </>
        )}
      </div>

      {/* Transitions */}
      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
        트랜지션
      </div>

      {clips.length < 2 && (
        <div style={{ color: '#555', fontSize: 11 }}>
          클립이 2개 이상일 때 트랜지션을 설정할 수 있습니다
        </div>
      )}

      {transitionIndices.map((idx) => {
        const t = transitions[idx] || { type: 'none', duration: 0 };
        return (
          <div key={idx} style={{ padding: 8, background: '#1a1a1a', borderRadius: 6, border: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, color: '#888' }}>
              클립 {idx + 1} → 클립 {idx + 2}
            </div>

            <select
              value={t.type}
              onChange={(e) => {
                const newType = e.target.value;
                // 전환 타입 변경 시 duration이 0이면 기본값 0.5 설정
                if (newType !== 'none' && (!t.duration || t.duration <= 0)) {
                  setTransition(idx, { type: newType, duration: 0.5 });
                } else if (newType === 'none') {
                  setTransition(idx, { type: newType, duration: 0 });
                } else {
                  setTransition(idx, { type: newType });
                }
              }}
              className="filter-select"
              style={{ width: '100%' }}
            >
              {TRANSITION_TYPES.map((tt) => (
                <option key={tt.value} value={tt.value}>{tt.label}</option>
              ))}
            </select>

            {/* Preview label */}
            {t.type !== 'none' && t.duration > 0 && (
              <div style={{ fontSize: 9, color: '#a78bfa', padding: '2px 0' }}>
                ✓ {TRANSITION_TYPES.find(tt => tt.value === t.type)?.label} 적용중 ({t.duration.toFixed(1)}s)
              </div>
            )}

            {t.type !== 'none' && (
              <>
                <label style={{ fontSize: 9, color: '#666' }}>
                  길이: {(t.duration || 0).toFixed(1)}s
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={t.duration || 0.5}
                  onChange={(e) => setTransition(idx, { duration: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#7c3aed' }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
