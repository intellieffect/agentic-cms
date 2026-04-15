import { Transforms, Editor, Element as SlateElement } from 'slate';

export const ELEMENT_CALLOUT = 'callout';

// 콜아웃 타입 정의
export type CalloutType = 'info' | 'warning' | 'success' | 'error' | 'tip';

export interface CalloutElement {
  type: 'callout';
  calloutType: CalloutType;
  children: any[];
}

// 콜아웃 스타일 정의
export const CALLOUT_STYLES: Record<CalloutType, {
  icon: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
}> = {
  info: {
    icon: 'ℹ️',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900',
    iconColor: 'text-blue-600',
  },
  warning: {
    icon: '⚠️',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
    iconColor: 'text-yellow-600',
  },
  success: {
    icon: '✅',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    iconColor: 'text-green-600',
  },
  error: {
    icon: '❌',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900',
    iconColor: 'text-red-600',
  },
  tip: {
    icon: '💡',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-900',
    iconColor: 'text-purple-600',
  },
};

// 콜아웃 블록 삽입
export const insertCallout = (editor: Editor, calloutType: CalloutType = 'info') => {
  const callout: CalloutElement = {
    type: ELEMENT_CALLOUT,
    calloutType,
    children: [
      {
        type: 'paragraph',
        children: [{ text: '여기에 내용을 입력하세요...' }],
      },
    ],
  };
  
  Transforms.insertNodes(editor, callout);
  Transforms.insertNodes(editor, {
    type: 'paragraph',
    children: [{ text: '' }],
  } as any);
};

// 콜아웃 타입 변경
export const setCalloutType = (editor: Editor, calloutType: CalloutType) => {
  const { selection } = editor;
  if (!selection) return;

  const [match] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_CALLOUT,
  });

  if (match) {
    const [, path] = match;
    Transforms.setNodes(
      editor,
      { calloutType } as Partial<CalloutElement>,
      { at: path }
    );
  }
};

// 현재 콜아웃 블록 안에 있는지 확인
export const isInCallout = (editor: Editor): boolean => {
  const { selection } = editor;
  if (!selection) return false;

  const [match] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      (n as any).type === ELEMENT_CALLOUT,
  });

  return !!match;
};