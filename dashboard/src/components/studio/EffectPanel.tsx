'use client';

import React from 'react';
import { useEditorStore } from './store';

const EFFECT_DEFS: { type: 'brightness' | 'contrast' | 'saturation' | 'blur' | 'grayscale' | 'sepia' | 'hueRotate'; label: string; icon: string; min: number; max: number; defaultVal: number; unit: string }[] = [
  { type: 'brightness', label: '밝기', icon: '☀️', min: 0, max: 200, defaultVal: 100, unit: '%' },
  { type: 'contrast', label: '대비', icon: '◑', min: 0, max: 200, defaultVal: 100, unit: '%' },
  { type: 'saturation', label: '채도', icon: '🎨', min: 0, max: 200, defaultVal: 100, unit: '%' },
  { type: 'blur', label: '블러', icon: '🌫️', min: 0, max: 20, defaultVal: 0, unit: 'px' },
  { type: 'grayscale', label: '흑백', icon: '⬛', min: 0, max: 100, defaultVal: 0, unit: '%' },
  { type: 'sepia', label: '세피아', icon: '🟤', min: 0, max: 100, defaultVal: 0, unit: '%' },
  { type: 'hueRotate', label: '색상 회전', icon: '🌈', min: 0, max: 360, defaultVal: 0, unit: '°' },
];

export const EffectPanel: React.FC = () => {
  const globalEffects = useEditorStore((s) => s.globalEffects);
  const updateGlobalEffect = useEditorStore((s) => s.updateGlobalEffect);

  const getValue = (type: string) => {
    const ef = globalEffects.find((e) => e.type === type);
    return ef?.value ?? 100;
  };

  const handleReset = () => {
    for (const def of EFFECT_DEFS) {
      updateGlobalEffect(def.type, def.defaultVal);
    }
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' }}>
          글로벌 이펙트
        </div>
        <button
          className="be-btn"
          style={{ fontSize: 9, padding: '2px 6px' }}
          onClick={handleReset}
        >
          초기화
        </button>
      </div>

      {EFFECT_DEFS.map((def) => {
        const val = getValue(def.type);
        const isModified = val !== def.defaultVal;
        return (
          <div key={def.type} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 10, color: isModified ? '#c4b5fd' : '#aaa' }}>
                {def.icon} {def.label}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, color: isModified ? '#c4b5fd' : '#555' }}>{val}{def.unit}</span>
                {isModified && (
                  <button
                    onClick={() => updateGlobalEffect(def.type, def.defaultVal)}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 9, padding: 0 }}
                    title="초기화"
                  >↺</button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.type === 'blur' ? 0.5 : 1}
              value={val}
              onChange={(e) => updateGlobalEffect(def.type, Number(e.target.value))}
              style={{ width: '100%', accentColor: '#8b5cf6' }}
            />
          </div>
        );
      })}

      <div style={{ fontSize: 9, color: '#444', marginTop: 4 }}>
        모든 클립에 일괄 적용됩니다. 100% = 원본
      </div>
    </div>
  );
};
