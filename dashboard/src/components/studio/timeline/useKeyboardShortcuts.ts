import { useEffect } from 'react';
import { useEditorStore } from '../store';

export function useKeyboardShortcuts(
  selectedBgmIndex: number,
  setSelectedBgmIndex: (idx: number) => void,
) {
  const selectedClipIndex = useEditorStore((s) => s.selectedClipIndex);
  const selectedSubIndex = useEditorStore((s) => s.selectedSubIndex);
  const removeClip = useEditorStore((s) => s.removeClip);
  const removeSubtitle = useEditorStore((s) => s.removeSubtitle);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const copySubtitle = useEditorStore((s) => s.copySubtitle);
  const copyClip = useEditorStore((s) => s.copyClip);
  const paste = useEditorStore((s) => s.paste);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || (active as HTMLElement).isContentEditable);

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isInput) return;
        const state = useEditorStore.getState();
        if (state.activePanel === 'clip' && state.selectedClipIndices.length > 1) {
          e.preventDefault();
          state.removeClips(state.selectedClipIndices);
        } else if (selectedClipIndex >= 0 && state.activePanel === 'clip') {
          e.preventDefault();
          removeClip(selectedClipIndex);
        } else if (selectedSubIndex >= 0 && state.activePanel === 'subtitle') {
          e.preventDefault();
          removeSubtitle(selectedSubIndex);
        } else if (selectedBgmIndex >= 0 && state.activePanel === 'bgm') {
          e.preventDefault();
          state.removeBgmClip(selectedBgmIndex);
          setSelectedBgmIndex(-1);
        }
      }

      // Undo: Cmd+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        undo();
      }

      // Redo: Cmd+Shift+Z
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        redo();
      }

      // Copy: Cmd+C
      if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        if (isInput) return;
        const state = useEditorStore.getState();
        if (state.activePanel === 'subtitle' && state.selectedSubIndex >= 0) {
          e.preventDefault();
          copySubtitle();
        } else if (state.activePanel === 'clip' && state.selectedClipIndex >= 0) {
          e.preventDefault();
          copyClip();
        }
      }

      // Paste: Cmd+V
      if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        if (isInput) return;
        e.preventDefault();
        paste();
      }

      // Fullscreen: F
      if (e.key === 'f' || e.key === 'F') {
        if (isInput) return;
        window.dispatchEvent(new CustomEvent('studio-fullscreen-toggle'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedClipIndex, selectedSubIndex, selectedBgmIndex, removeClip, removeSubtitle, undo, redo, copySubtitle, copyClip, paste, setSelectedBgmIndex]);
}
