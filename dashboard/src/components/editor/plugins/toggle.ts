import { Transforms, Editor, Element as SlateElement, Path } from 'slate';

export const ELEMENT_TOGGLE = 'toggle';
export const ELEMENT_TOGGLE_CONTENT = 'toggle-content';

// 토글 타입 정의
export interface ToggleElement {
  type: 'toggle';
  isOpen?: boolean;
  children: any[];
}

export interface ToggleContentElement {
  type: 'toggle-content';
  children: any[];
}

// 토글 블록 삽입
export const insertToggle = (editor: Editor) => {
  const toggle: ToggleElement = {
    type: ELEMENT_TOGGLE,
    isOpen: true,
    children: [
      {
        type: 'paragraph',
        children: [{ text: '토글 제목' }],
      },
      {
        type: ELEMENT_TOGGLE_CONTENT,
        children: [
          {
            type: 'paragraph',
            children: [{ text: '토글 내용을 입력하세요...' }],
          },
        ],
      },
    ],
  };
  
  Transforms.insertNodes(editor, toggle);
  Transforms.insertNodes(editor, {
    type: 'paragraph',
    children: [{ text: '' }],
  } as any);
};

// 토글 상태 변경
export const toggleToggleState = (editor: Editor, path: Path) => {
  const [node] = Editor.node(editor, path);
  if (SlateElement.isElement(node) && (node as any).type === ELEMENT_TOGGLE) {
    const newProperties: Partial<ToggleElement> = {
      isOpen: !(node as ToggleElement).isOpen,
    };
    Transforms.setNodes(editor, newProperties, { at: path });
  }
};

// 현재 토글 블록 안에 있는지 확인
export const isInToggle = (editor: Editor): boolean => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TOGGLE,
  });

  return !!match;
};

// 토글 블록의 경로 가져오기
export const getTogglePath = (editor: Editor): Path | null => {
  const { selection } = editor;
  if (!selection) return null;

  const [match] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_TOGGLE,
  });

  return match ? match[1] : null;
};