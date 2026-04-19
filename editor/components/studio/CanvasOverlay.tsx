'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from './store';

const FPS = 30;

interface DragState {
  subIndex: number;
  startMouseX: number;
  startMouseY: number;
  startSubX: number;
  startSubY: number;
  axisLock: 'none' | 'h' | 'v'; // Shift axis lock
}

interface ResizeState {
  subIndex: number;
  handle: string;
  startMouseX: number;
  startMouseY: number;
  startSize: number;
  startBoxWidth?: number;
}

export const CanvasOverlay: React.FC = () => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);

  const currentFrame = useEditorStore((s) => s.currentFrame);
  const globalSubs = useEditorStore((s) => s.globalSubs);
  const selectedSubIndex = useEditorStore((s) => s.selectedSubIndex);
  const setSelectedSubIndex = useEditorStore((s) => s.setSelectedSubIndex);
  const updateGlobalSub = useEditorStore((s) => s.updateGlobalSub);

  const currentTime = currentFrame / FPS;

  // 현재 프레임에 표시되는 활성 자막 필터링
  const activeSubs = globalSubs
    .map((sub, index) => ({ sub, index }))
    .filter(({ sub }) => currentTime >= sub.start && currentTime < sub.end);

  // 좌표 변환: 마우스 px → % (오버레이 기준)
  const toPercent = useCallback(
    (clientX: number, clientY: number) => {
      const el = overlayRef.current;
      if (!el) return { x: 50, y: 80 };
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
    },
    [],
  );

  // 드래그 시작
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, subIndex: number) => {
      // Don't start drag if we're in editing mode for this subtitle
      if (editingIndex === subIndex) return;
      e.stopPropagation();
      e.preventDefault();
      const sub = globalSubs[subIndex];
      setSelectedSubIndex(subIndex);
      setDragState({
        subIndex,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startSubX: sub.style?.x ?? 50,
        startSubY: sub.style?.y ?? 80,
        axisLock: 'none',
      });
    },
    [globalSubs, setSelectedSubIndex, editingIndex],
  );

  // 리사이즈 핸들 시작
  const handleResizeDown = useCallback(
    (e: React.MouseEvent, subIndex: number, handle: string) => {
      e.stopPropagation();
      e.preventDefault();
      const sub = globalSubs[subIndex];
      setResizeState({
        subIndex,
        handle,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startSize: sub.style?.size ?? 48,
        startBoxWidth: sub.style?.boxWidth,
      });
    },
    [globalSubs],
  );

  // Double-click to edit (Feature 5)
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent, subIndex: number) => {
      e.stopPropagation();
      e.preventDefault();
      const sub = globalSubs[subIndex];
      setSelectedSubIndex(subIndex);
      setEditingIndex(subIndex);
      setEditText(sub.text);
      // Focus textarea after render
      setTimeout(() => editRef.current?.focus(), 0);
    },
    [globalSubs, setSelectedSubIndex],
  );

  const commitEdit = useCallback(() => {
    if (editingIndex !== null && editText !== globalSubs[editingIndex]?.text) {
      updateGlobalSub(editingIndex, { text: editText });
    }
    setEditingIndex(null);
  }, [editingIndex, editText, globalSubs, updateGlobalSub]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  // mousemove / mouseup 글로벌 핸들러
  useEffect(() => {
    if (!dragState && !resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      if (dragState) {
        const dx = ((e.clientX - dragState.startMouseX) / rect.width) * 100;
        const dy = ((e.clientY - dragState.startMouseY) / rect.height) * 100;

        let finalDx = dx;
        let finalDy = dy;

        // Feature 6: Shift axis lock
        if (e.shiftKey) {
          if (dragState.axisLock === 'none') {
            // Determine axis based on initial movement
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              const lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
              setDragState({ ...dragState, axisLock: lock });
              if (lock === 'h') finalDy = 0;
              else finalDx = 0;
            }
          } else {
            if (dragState.axisLock === 'h') finalDy = 0;
            else finalDx = 0;
          }
        } else {
          // Release shift → reset lock
          if (dragState.axisLock !== 'none') {
            setDragState({ ...dragState, axisLock: 'none' });
          }
        }

        const newX = Math.max(0, Math.min(100, dragState.startSubX + finalDx));
        const newY = Math.max(0, Math.min(100, dragState.startSubY + finalDy));
        updateGlobalSub(dragState.subIndex, {
          style: { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 },
        });
      }

      if (resizeState) {
        // Feature 6: Shift = maintain aspect ratio (size + boxWidth proportional)
        const dy = resizeState.startMouseY - e.clientY;
        const scale = dy / rect.height;
        const newSize = Math.max(12, Math.min(200, resizeState.startSize + scale * 200));

        if (e.shiftKey && resizeState.startBoxWidth) {
          // Maintain aspect ratio: scale boxWidth proportionally
          const ratio = newSize / resizeState.startSize;
          const newBoxWidth = Math.max(10, Math.min(100, (resizeState.startBoxWidth ?? 100) * ratio));
          updateGlobalSub(resizeState.subIndex, {
            style: { size: Math.round(newSize), boxWidth: Math.round(newBoxWidth) },
          });
        } else {
          updateGlobalSub(resizeState.subIndex, {
            style: { size: Math.round(newSize) },
          });
        }
      }
    };

    const handleMouseUp = () => {
      // Mark that we just finished dragging (to prevent overlay click from deselecting)
      if (dragState || resizeState) {
        wasDraggingRef.current = true;
        setTimeout(() => { wasDraggingRef.current = false; }, 100);
      }
      setDragState(null);
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, updateGlobalSub]);

  // ESC로 선택 해제 / 편집 취소
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingIndex !== null) {
          cancelEdit();
        } else if (selectedSubIndex >= 0) {
          setSelectedSubIndex(-1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSubIndex, setSelectedSubIndex, editingIndex, cancelEdit]);

  // 빈 영역 클릭 시 선택 해제 (드래그 직후에는 해제 안 함)
  const handleOverlayClick = useCallback(() => {
    if (wasDraggingRef.current) return; // 드래그 직후 클릭 무시
    if (editingIndex !== null) {
      commitEdit();
    }
    if (selectedSubIndex >= 0) {
      setSelectedSubIndex(-1);
    }
  }, [selectedSubIndex, setSelectedSubIndex, editingIndex, commitEdit]);

  const resizeHandles = ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'];
  const handlePositions: Record<string, React.CSSProperties> = {
    tl: { top: -4, left: -4, cursor: 'nwse-resize' },
    tr: { top: -4, right: -4, cursor: 'nesw-resize' },
    bl: { bottom: -4, left: -4, cursor: 'nesw-resize' },
    br: { bottom: -4, right: -4, cursor: 'nwse-resize' },
    t: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    b: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    l: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    r: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: activeSubs.length > 0 ? 'auto' : 'none',
        zIndex: 10,
      }}
    >
      {activeSubs.map(({ sub, index }) => {
        const isSelected = selectedSubIndex === index;
        const isEditing = editingIndex === index;
        const x = sub.style?.x ?? 50;
        const y = sub.style?.y ?? 80;

        return (
          <React.Fragment key={index}>
            {/* 드래그 핸들 — 텍스트 독립, 고정 크기 */}
            <div
              onMouseDown={(e) => handleMouseDown(e, index)}
              onDoubleClick={(e) => handleDoubleClick(e, index)}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                cursor: dragState?.subIndex === index ? 'grabbing' : 'grab',
                pointerEvents: 'auto',
                zIndex: 2,
              }}
            >
              {/* 십자 아이콘 */}
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: isSelected ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.5)',
                border: isSelected ? '1.5px solid #fff' : '1.5px solid rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                color: isSelected ? '#fff' : '#333',
                fontWeight: 'bold',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}>
                ✛
              </div>
            </div>

            {/* 위치 가이드 라인 (선택 시) */}
            {isSelected && !isEditing && (
              <>
                <div style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, background: 'rgba(59,130,246,0.3)', pointerEvents: 'none', zIndex: 1 }} />
                <div style={{ position: 'absolute', top: `${y}%`, left: 0, right: 0, height: 1, background: 'rgba(59,130,246,0.3)', pointerEvents: 'none', zIndex: 1 }} />
                <div style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, 18px)',
                  fontSize: 9,
                  color: '#3B82F6',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  pointerEvents: 'none',
                  zIndex: 3,
                  whiteSpace: 'nowrap',
                }}>
                  {Math.round(x)}%, {Math.round(y)}%
                </div>
              </>
            )}

            {/* 인라인 편집 (더블클릭) */}
            {isEditing && (
              <div style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 5,
                pointerEvents: 'auto',
              }}>
                <textarea
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                    e.stopPropagation();
                  }}
                  onBlur={() => commitEdit()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(0,0,0,0.85)',
                    border: '2px solid #3B82F6',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: 14,
                    fontFamily: "'BMDOHYEON', sans-serif",
                    textAlign: 'center',
                    padding: '8px 12px',
                    resize: 'none',
                    outline: 'none',
                    minWidth: 200,
                    minHeight: 40,
                  }}
                  rows={editText.split('\n').length}
                />
              </div>
            )}

            {/* 리사이즈 핸들 — 폰트 크기 조절 (선택 시) */}
            {isSelected && !isEditing && (
              <div
                onMouseDown={(e) => handleResizeDown(e, index, 'br')}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(8px, -20px)',
                  width: 12,
                  height: 12,
                  background: '#3B82F6',
                  border: '1px solid #fff',
                  borderRadius: 2,
                  cursor: 'nwse-resize',
                  pointerEvents: 'auto',
                  zIndex: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 7,
                  color: '#fff',
                }}>
                Aa
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
