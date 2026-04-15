import {Editor, Point, Range, Transforms} from 'slate';
import {toggleBlock} from './basic-blocks';

// 자동 포맷 규칙 타입
interface AutoformatRule {
    trigger: string;
    match: RegExp;
    format: (editor: Editor, match: RegExpMatchArray) => void;
}

// 마크다운 스타일 자동 포맷 규칙
export const AUTOFORMAT_RULES: AutoformatRule[] = [
    // 제목 (# ~ ######)
    {
        trigger: ' ',
        match: /^(#{1,6})\s$/,
        format: (editor, match) => {
            const level = match[1].length;
            Transforms.delete(editor, {
                distance: match[0].length,
                reverse: true,
                unit: 'character',
            });
            toggleBlock(editor, `h${level}`);
        },
    },
    // 순서 없는 목록 (-, *, +)
    {
        trigger: ' ',
        match: /^[-*+]\s$/,
        format: (editor) => {
            Transforms.delete(editor, {
                distance: 2,
                reverse: true,
                unit: 'character',
            });
            toggleBlock(editor, 'ul');
        },
    },
    // 순서 있는 목록 (1., 2., etc.)
    {
        trigger: ' ',
        match: /^(\d+)\.\s$/,
        format: (editor, match) => {
            Transforms.delete(editor, {
                distance: match[0].length,
                reverse: true,
                unit: 'character',
            });
            toggleBlock(editor, 'ol');
        },
    },
    // 인용구 (>)
    {
        trigger: ' ',
        match: /^>\s$/,
        format: (editor) => {
            Transforms.delete(editor, {
                distance: 2,
                reverse: true,
                unit: 'character',
            });
            toggleBlock(editor, 'blockquote');
        },
    },
    // 구분선 (---, ***, ___)
    {
        trigger: '-',
        match: /^---$/,
        format: (editor) => {
            Transforms.delete(editor, {
                distance: 3,
                reverse: true,
                unit: 'character',
            });
            Transforms.insertNodes(editor, {
                type: 'hr',
                children: [{text: ''}],
            } as any);
            Transforms.insertNodes(editor, {
                type: 'paragraph',
                children: [{text: ''}],
            } as any);
        },
    },
    {
        trigger: '*',
        match: /^\*\*\*$/,
        format: (editor) => {
            Transforms.delete(editor, {
                distance: 3,
                reverse: true,
                unit: 'character',
            });
            Transforms.insertNodes(editor, {
                type: 'hr',
                children: [{text: ''}],
            } as any);
            Transforms.insertNodes(editor, {
                type: 'paragraph',
                children: [{text: ''}],
            } as any);
        },
    },
    // 코드 블록 (```)
    {
        trigger: '`',
        match: /^```$/,
        format: (editor) => {
            Transforms.delete(editor, {
                distance: 3,
                reverse: true,
                unit: 'character',
            });
            Transforms.insertNodes(editor, {
                type: 'code-block',
                language: 'plaintext',
                children: [{text: ''}],
            } as any);
        },
    },
];

// 인라인 포맷 규칙
export const INLINE_FORMAT_RULES = [
    // 굵게 (**text**)
    {
        match: /\*\*([^*]+)\*\*/,
        format: (editor: Editor, match: RegExpMatchArray, start: Point) => {
            const text = match[1];
            const end = Editor.after(editor, start, {distance: match[0].length});

            if (!end) return;

            Transforms.delete(editor, {
                at: {anchor: start, focus: end},
            });

            Transforms.insertNodes(editor, {
                text,
                bold: true,
            } as any, {at: start});
        },
    },
    // 기울임 (*text* or _text_)
    {
        match: /\*([^*]+)\*/,
        format: (editor: Editor, match: RegExpMatchArray, start: Point) => {
            const text = match[1];
            const end = Editor.after(editor, start, {distance: match[0].length});

            if (!end) return;

            Transforms.delete(editor, {
                at: {anchor: start, focus: end},
            });

            Transforms.insertNodes(editor, {
                text,
                italic: true,
            } as any, {at: start});
        },
    },
    {
        match: /_([^_]+)_/,
        format: (editor: Editor, match: RegExpMatchArray, start: Point) => {
            const text = match[1];
            const end = Editor.after(editor, start, {distance: match[0].length});

            if (!end) return;

            Transforms.delete(editor, {
                at: {anchor: start, focus: end},
            });

            Transforms.insertNodes(editor, {
                text,
                italic: true,
            } as any, {at: start});
        },
    },
    // 취소선 (~~text~~)
    {
        match: /~~([^~]+)~~/,
        format: (editor: Editor, match: RegExpMatchArray, start: Point) => {
            const text = match[1];
            const end = Editor.after(editor, start, {distance: match[0].length});

            if (!end) return;

            Transforms.delete(editor, {
                at: {anchor: start, focus: end},
            });

            Transforms.insertNodes(editor, {
                text,
                strikethrough: true,
            } as any, {at: start});
        },
    },
    // 인라인 코드 (`code`)
    {
        match: /`([^`]+)`/,
        format: (editor: Editor, match: RegExpMatchArray, start: Point) => {
            const text = match[1];
            const end = Editor.after(editor, start, {distance: match[0].length});

            if (!end) return;

            Transforms.delete(editor, {
                at: {anchor: start, focus: end},
            });

            Transforms.insertNodes(editor, {
                text,
                code: true,
            } as any, {at: start});
        },
    },
];

// 자동 포맷 적용 함수
export const handleAutoformat = (editor: Editor, event: React.KeyboardEvent) => {
    const {selection} = editor;
    if (!selection || !Range.isCollapsed(selection)) return false;

    // 블록 레벨 자동 포맷
    const rule = AUTOFORMAT_RULES.find(r => r.trigger === event.key);
    if (rule) {
        const [node, path] = Editor.node(editor, selection);
        if ('text' in node) {
            const text = node.text;
            const match = text.match(rule.match);
            if (match) {
                event.preventDefault();
                rule.format(editor, match);
                return true;
            }
        }
    }

    // 인라인 포맷 (스페이스 키를 눌렀을 때)
    if (event.key === ' ') {
        const [node, path] = Editor.node(editor, selection);
        if ('text' in node) {
            const text = node.text;

            for (const rule of INLINE_FORMAT_RULES) {
                const match = text.match(rule.match);
                if (match) {
                    const start = {path, offset: text.indexOf(match[0])};
                    event.preventDefault();
                    rule.format(editor, match, start);
                    return true;
                }
            }
        }
    }

    return false;
};
