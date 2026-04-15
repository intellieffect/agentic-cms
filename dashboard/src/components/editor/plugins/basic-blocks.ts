import {Editor, Element as SlateElement, Transforms} from 'slate';

// 블록 타입 정의
export const ELEMENT_PARAGRAPH = 'paragraph';
export const ELEMENT_H1 = 'h1';
export const ELEMENT_H2 = 'h2';
export const ELEMENT_H3 = 'h3';
export const ELEMENT_H4 = 'h4';
export const ELEMENT_H5 = 'h5';
export const ELEMENT_H6 = 'h6';
export const ELEMENT_BLOCKQUOTE = 'blockquote';
export const ELEMENT_UL = 'ul';
export const ELEMENT_OL = 'ol';
export const ELEMENT_LI = 'li';
export const ELEMENT_HR = 'hr';

// 타입 정의
export type ParagraphElement = {
    type: 'paragraph';
    children: any[];
};

export type HeadingElement = {
    type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    children: any[];
};

export type BlockquoteElement = {
    type: 'blockquote';
    children: any[];
};

export type ListElement = {
    type: 'ul' | 'ol';
    children: any[];
};

export type ListItemElement = {
    type: 'li';
    children: any[];
};

export type HorizontalRuleElement = {
    type: 'hr';
    children: any[];
};

export type CustomElement =
    | ParagraphElement
    | HeadingElement
    | BlockquoteElement
    | ListElement
    | ListItemElement
    | HorizontalRuleElement;

// 헬퍼 함수들
export const toggleBlock = (editor: Editor, format: string) => {
    const isActive = isBlockActive(editor, format);
    const isList = ['ul', 'ol'].includes(format);

    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            ['ul', 'ol'].includes((n as any).type),
        split: true,
    });

    const newProperties: any = {
        type: isActive ? ELEMENT_PARAGRAPH : isList ? 'li' : format,
    };

    Transforms.setNodes(editor, newProperties);

    if (!isActive && isList) {
        const block = {type: format, children: []} as any;
        Transforms.wrapNodes(editor, block);
    }
};

export const isBlockActive = (editor: Editor, format: string) => {
    const {selection} = editor;
    if (!selection) return false;

    const [match] = Editor.nodes(editor, {
        at: Editor.unhangRange(editor, selection),
        match: n =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            (n as any).type === format,
    });

    return !!match;
};
