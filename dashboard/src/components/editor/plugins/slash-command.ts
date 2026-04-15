import {Editor, Range, Transforms} from 'slate';
import {insertCodeBlock} from './code-block';
import {insertTable} from './table';
import {insertToggle} from './toggle';
import {insertCallout} from './callout';

export interface SlashCommand {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    command: string;
    onSelect: (editor: Editor) => void;
}

// 슬래시 명령어 목록
export const SLASH_COMMANDS: SlashCommand[] = [
    {
        title: '제목 1',
        description: '큰 제목',
        command: 'h1',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'h1'} as any);
        },
    },
    {
        title: '제목 2',
        description: '중간 제목',
        command: 'h2',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'h2'} as any);
        },
    },
    {
        title: '제목 3',
        description: '작은 제목',
        command: 'h3',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'h3'} as any);
        },
    },
    {
        title: '텍스트',
        description: '일반 텍스트',
        command: 'p',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'paragraph'} as any);
        },
    },
    {
        title: '순서 없는 목록',
        description: '• 목록 항목',
        command: 'ul',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'li'} as any);
            Transforms.wrapNodes(editor, {type: 'ul', children: []} as any);
        },
    },
    {
        title: '순서 있는 목록',
        description: '1. 목록 항목',
        command: 'ol',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'li'} as any);
            Transforms.wrapNodes(editor, {type: 'ol', children: []} as any);
        },
    },
    {
        title: '인용구',
        description: '인용된 텍스트',
        command: 'quote',
        onSelect: (editor) => {
            Transforms.setNodes(editor, {type: 'blockquote'} as any);
        },
    },
    {
        title: '구분선',
        description: '수평선',
        command: 'hr',
        onSelect: (editor) => {
            Transforms.insertNodes(editor, {type: 'hr', children: [{text: ''}]} as any);
            Transforms.insertNodes(editor, {type: 'paragraph', children: [{text: ''}]} as any);
        },
    },
    {
        title: '이미지',
        description: '이미지 업로드',
        command: 'image',
        onSelect: (editor) => {
            // 파일 선택 input을 생성하고 클릭
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                    // uploadImage와 insertImage는 별도로 import 필요
                    const url = URL.createObjectURL(file); // 임시 URL
                    Transforms.insertNodes(editor, {
                        type: 'image',
                        url,
                        alt: file.name,
                        children: [{text: ''}]
                    } as any);
                    Transforms.insertNodes(editor, {
                        type: 'paragraph',
                        children: [{text: ''}]
                    } as any);
                }
            };
            input.click();
        },
    },
    {
        title: '코드 블록',
        description: '코드 스니펫',
        command: 'code',
        onSelect: (editor) => {
            insertCodeBlock(editor);
        },
    },
    {
        title: '테이블',
        description: '표 삽입',
        command: 'table',
        onSelect: (editor) => {
            insertTable(editor, 3, 3);
        },
    },
    {
        title: '토글',
        description: '접기/펼치기',
        command: 'toggle',
        onSelect: (editor) => {
            insertToggle(editor);
        },
    },
    {
        title: '콜아웃',
        description: '강조 박스',
        command: 'callout',
        onSelect: (editor) => {
            insertCallout(editor, 'info');
        },
    },
];

// 현재 슬래시 명령어 검색어 가져오기
export const getSlashCommandQuery = (editor: Editor): string | null => {
    const {selection} = editor;
    if (!selection || !Range.isCollapsed(selection)) return null;

    const [start] = Range.edges(selection);
    const charBefore = Editor.before(editor, start, {unit: 'character'});
    const beforeRange = charBefore && Editor.range(editor, charBefore, start);
    const beforeText = beforeRange && Editor.string(editor, beforeRange);

    if (beforeText !== '/') return null;

    const after = Editor.after(editor, start);
    const afterRange = Editor.range(editor, start, after || start);
    const afterText = Editor.string(editor, afterRange);

    const textBefore = Editor.string(editor, {
        anchor: {path: start.path, offset: 0},
        focus: start,
    });

    const match = textBefore.match(/\/(\w*)$/);
    return match ? match[1] : '';
};

// 슬래시 명령어 필터링
export const filterSlashCommands = (query: string): SlashCommand[] => {
    if (!query) return SLASH_COMMANDS;

    return SLASH_COMMANDS.filter(cmd =>
        cmd.title.toLowerCase().includes(query.toLowerCase()) ||
        cmd.command.toLowerCase().includes(query.toLowerCase())
    );
};

// 슬래시 명령어 실행
export const executeSlashCommand = (editor: Editor, command: SlashCommand) => {
    const {selection} = editor;
    if (!selection) return;

    const [start] = Range.edges(selection);
    const charBefore = Editor.before(editor, start, {unit: 'character'});

    if (!charBefore) return;

    // 슬래시부터 현재 위치까지 삭제
    const beforeRange = Editor.range(editor, charBefore, start);
    const beforeText = Editor.string(editor, beforeRange);

    if (beforeText.startsWith('/')) {
        // 슬래시 명령어 텍스트 삭제
        const deleteStart = Editor.before(editor, start, {
            unit: 'character',
            distance: beforeText.length
        });

        if (deleteStart) {
            Transforms.delete(editor, {
                at: Editor.range(editor, deleteStart, start),
            });
        }
    }

    // 명령어 실행
    command.onSelect(editor);
};
