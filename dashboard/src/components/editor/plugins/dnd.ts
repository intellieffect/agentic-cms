import {Editor, Element as SlateElement, Path, Transforms} from 'slate';
import {ReactEditor} from 'slate-react';
import React from 'react';

// 드래그 중인 요소 정보
export interface DragInfo {
    draggedElement: SlateElement;
    draggedPath: Path;
}

// 드롭 위치 계산
export const getDropTargetPath = (
    editor: Editor,
    event: React.DragEvent
): { path: Path; isAfter: boolean } | null => {
    // 마우스 위치에서 가장 가까운 블록 찾기
    const elements = document.querySelectorAll('[data-slate-node="element"]');
    let closestElement: Element | null = null;
    let closestDistance = Infinity;
    let isAfter = false;

    elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const distance = Math.abs(event.clientY - midY);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = el;
            isAfter = event.clientY > midY;
        }
    });

    if (!closestElement) return null;

    try {
        const node = ReactEditor.toSlateNode(editor as ReactEditor, closestElement as HTMLElement);
        const path = ReactEditor.findPath(editor as ReactEditor, node);
        return {path, isAfter};
    } catch (error) {
        console.error('Error getting drop target:', error);
        return null;
    }
};

// 블록 이동
export const moveBlock = (
    editor: Editor,
    fromPath: Path,
    targetPath: Path,
    isAfter: boolean
) => {
    // 같은 위치로 이동하는 경우 무시
    if (Path.equals(fromPath, targetPath)) {
        if (!isAfter || !Path.next(targetPath)) return;
    }

    const [node] = Editor.node(editor, fromPath);

    Editor.withoutNormalizing(editor, () => {
        // 삽입 위치 계산
        let insertPath: Path;

        if (isAfter) {
            // 대상 요소 뒤에 삽입
            try {
                insertPath = Path.next(targetPath);
            } catch (error) {
                // 마지막 요소인 경우
                insertPath = [...targetPath.slice(0, -1), targetPath[targetPath.length - 1] + 1];
            }
        } else {
            // 대상 요소 앞에 삽입
            insertPath = targetPath;
        }

        // 원본이 대상보다 앞에 있는 경우 경로 조정
        if (Path.isBefore(fromPath, insertPath)) {
            insertPath = Path.previous(insertPath);
        }

        // 이동 실행
        Transforms.removeNodes(editor, {at: fromPath});
        Transforms.insertNodes(editor, node, {at: insertPath});
    });
};

// 드래그 시작 핸들러
export const handleDragStart = (
    editor: Editor,
    event: React.DragEvent,
    element: SlateElement,
    path: Path
) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify({element, path}));

    // 드래그 중인 요소 표시
    const draggedElement = event.currentTarget.closest('.group') as HTMLElement;
    if (draggedElement) {
        requestAnimationFrame(() => {
            draggedElement.classList.add('dragging');
        });
    }
};

// 드래그 종료 핸들러
export const handleDragEnd = (event: React.DragEvent) => {
    // 드래그 스타일 제거
    const draggedElement = event.currentTarget.closest('.group') as HTMLElement;
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }

    // 모든 드롭 인디케이터 제거
    document.querySelectorAll('.drop-indicator').forEach(el => {
        el.classList.remove('drop-indicator', 'drop-indicator-before', 'drop-indicator-after');
    });
};

// 드롭 핸들러
export const handleDrop = (
    editor: Editor | ReactEditor,
    event: React.DragEvent
) => {
    event.preventDefault();
    event.stopPropagation();

    // 드롭 인디케이터 제거
    document.querySelectorAll('.drop-indicator').forEach(el => {
        el.classList.remove('drop-indicator', 'drop-indicator-before', 'drop-indicator-after');
    });

    try {
        const data = event.dataTransfer.getData('text/plain');
        if (!data) return;

        const {path: fromPath} = JSON.parse(data);
        const dropTarget = getDropTargetPath(editor, event);

        if (dropTarget) {
            const {path: targetPath, isAfter} = dropTarget;
            console.log('Moving from:', fromPath, 'to:', targetPath, 'isAfter:', isAfter);
            moveBlock(editor, fromPath, targetPath, isAfter);
        }
    } catch (error) {
        console.error('Error handling drop:', error);
    }
};

// 드래그 오버 핸들러
export const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';

    // 가장 가까운 블록 찾기
    const elements = document.querySelectorAll('[data-slate-node="element"]');
    let closestElement: Element | null = null;
    let closestDistance = Infinity;

    elements.forEach((el) => {
        // 드래그 중인 요소는 제외
        if (el.classList.contains('dragging')) return;

        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const distance = Math.abs(event.clientY - midY);

        if (distance < closestDistance && distance < 50) { // 50px 이내에서만 반응
            closestDistance = distance;
            closestElement = el;
        }
    });

    // 기존 인디케이터 제거
    document.querySelectorAll('.drop-indicator').forEach(el => {
        el.classList.remove('drop-indicator', 'drop-indicator-before', 'drop-indicator-after');
    });

    // 새 인디케이터 추가
    if (closestElement) {
        const element = closestElement as Element;
        const rect = element.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const isAfter = event.clientY > midY;

        element.classList.add('drop-indicator');
        element.classList.add(isAfter ? 'drop-indicator-after' : 'drop-indicator-before');
    }
};

// 드래그 떠남 핸들러
export const handleDragLeave = (event: React.DragEvent) => {
    const target = event.target as HTMLElement;
    const blockElement = target.closest('[data-slate-node="element"]');
    if (blockElement) {
        blockElement.classList.remove('drop-indicator', 'drop-indicator-before', 'drop-indicator-after');
    }
};
