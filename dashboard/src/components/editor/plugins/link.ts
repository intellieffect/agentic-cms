import { Transforms, Editor, Range, Element as SlateElement } from 'slate';

export const ELEMENT_LINK = 'link';

// 링크 타입 정의
export interface LinkElement {
  type: 'link';
  url: string;
  children: any[];
}

// 링크 삽입/래핑
export const wrapLink = (editor: Editor, url: string) => {
  if (isLinkActive(editor)) {
    unwrapLink(editor);
  }

  const { selection } = editor;
  const isCollapsed = selection && Range.isCollapsed(selection);
  const link: LinkElement = {
    type: ELEMENT_LINK,
    url,
    children: isCollapsed ? [{ text: url }] : [],
  };

  if (isCollapsed) {
    Transforms.insertNodes(editor, link);
  } else {
    Transforms.wrapNodes(editor, link, { split: true });
    Transforms.collapse(editor, { edge: 'end' });
  }
};

// 링크 제거
export const unwrapLink = (editor: Editor) => {
  Transforms.unwrapNodes(editor, {
    match: n =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === ELEMENT_LINK,
  });
};

// 링크 활성 상태 확인
export const isLinkActive = (editor: Editor) => {
  const [link] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === ELEMENT_LINK,
  });
  return !!link;
};

// 현재 링크 URL 가져오기
export const getLinkUrl = (editor: Editor): string | null => {
  const [link] = Editor.nodes(editor, {
    match: n =>
      !Editor.isEditor(n) && SlateElement.isElement(n) && (n as any).type === ELEMENT_LINK,
  });
  
  if (link) {
    const [node] = link;
    return (node as LinkElement).url;
  }
  
  return null;
};

// URL 유효성 검사
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    // 상대 경로도 허용
    return /^\//.test(url);
  }
};