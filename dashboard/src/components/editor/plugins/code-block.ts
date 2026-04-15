import {Editor, Element as SlateElement, Path, Transforms} from 'slate';

export const ELEMENT_CODE_BLOCK = 'code-block';
export const ELEMENT_CODE_LINE = 'code-line';

export interface CodeBlockElement {
    type: 'code-block';
    language?: string;
    children: any[];
}

// 지원하는 프로그래밍 언어 목록
export const SUPPORTED_LANGUAGES = [
    {value: 'javascript', label: 'JavaScript'},
    {value: 'typescript', label: 'TypeScript'},
    {value: 'python', label: 'Python'},
    {value: 'java', label: 'Java'},
    {value: 'cpp', label: 'C++'},
    {value: 'csharp', label: 'C#'},
    {value: 'html', label: 'HTML'},
    {value: 'css', label: 'CSS'},
    {value: 'json', label: 'JSON'},
    {value: 'sql', label: 'SQL'},
    {value: 'bash', label: 'Bash'},
    {value: 'markdown', label: 'Markdown'},
    {value: 'plaintext', label: 'Plain Text'},
];

// 코드 블록 삽입
export const insertCodeBlock = (editor: Editor, language: string = 'plaintext') => {
    const codeBlock: CodeBlockElement = {
        type: ELEMENT_CODE_BLOCK,
        language,
        children: [{
            type: ELEMENT_CODE_LINE,
            children: [{text: ''}],
        }],
    } as any;

    Transforms.insertNodes(editor, codeBlock);
    Transforms.insertNodes(editor, {
        type: 'paragraph',
        children: [{text: ''}],
    } as any);
};

// 코드 블록 언어 변경
export const setCodeBlockLanguage = (editor: Editor, language: string) => {
    const {selection} = editor;
    if (!selection) return;

    const [match] = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            (n as any).type === ELEMENT_CODE_BLOCK,
    });

    if (match) {
        const [, path] = match;
        Transforms.setNodes(
            editor,
            {language} as Partial<CodeBlockElement>,
            {at: path}
        );
    }
};

// 현재 코드 블록인지 확인
export const isCodeBlockActive = (editor: Editor): boolean => {
    const {selection} = editor;
    if (!selection) return false;

    const [match] = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) &&
            SlateElement.isElement(n) &&
            (n as any).type === ELEMENT_CODE_BLOCK,
    });

    return !!match;
};

// 코드 블록에서 Tab 키 처리
export const handleCodeBlockTab = (editor: Editor, event: React.KeyboardEvent): boolean => {
    if (isCodeBlockActive(editor)) {
        event.preventDefault();
        editor.insertText('  '); // 2 spaces for tab
        return true;
    }
    return false;
};

// 코드 블록에서 Enter 키 처리 (새 코드 라인 생성)
export const handleCodeBlockEnter = (editor: Editor, event: React.KeyboardEvent): boolean => {
    if (isCodeBlockActive(editor)) {
        event.preventDefault();

        // 현재 라인에서 커서 이후의 텍스트를 가져옴
        const {selection} = editor;
        if (!selection) return false;

        const [node, path] = Editor.node(editor, selection);
        const text = (node as any).text || '';
        const offset = selection.anchor.offset;

        // 현재 라인의 들여쓰기 계산
        const match = text.match(/^(\s*)/);
        const indent = match ? match[1] : '';

        // 커서 이후의 텍스트를 제거
        const afterText = text.slice(offset);
        Transforms.delete(editor, {
            at: {
                anchor: {path: selection.anchor.path, offset},
                focus: {path: selection.anchor.path, offset: text.length}
            }
        });

        // 새로운 코드 라인 삽입
        const newLine = {
            type: ELEMENT_CODE_LINE,
            children: [{text: indent + afterText}],
        };

        const [parentNode, parentPath] = Editor.parent(editor, path);
        if ((parentNode as any).type === ELEMENT_CODE_LINE) {
            const codeBlockPath = Path.parent(parentPath);
            const nextPath = Path.next(parentPath);
            Transforms.insertNodes(editor, newLine, {at: nextPath});
            Transforms.select(editor, {path: [...nextPath, 0], offset: indent.length});
        }

        return true;
    }
    return false;
};
