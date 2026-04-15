'use client';

import {useState} from 'react';
import {useEditorRef} from 'platejs/react';
import {FixedToolbar} from '@/components/ui/fixed-toolbar';
import {MarkToolbarButton} from '@/components/ui/mark-toolbar-button';
import {ToolbarButton} from '@/components/ui/toolbar';
import {
    Bold,
    Code,
    Columns2,
    Columns3,
    FileCode,
    Heading1,
    Heading2,
    Heading3,
    Highlighter,
    Image as ImageIcon,
    Info,
    Italic,
    Quote,
    Strikethrough,
    Table,
    Underline,
    Video
} from 'lucide-react';
import {insertColumnGroup} from '@platejs/layout';
import {insertTable} from '@platejs/table';
import {ImageUploadDialog} from '@/components/ui/image-upload-dialog';
import {MediaEmbedDialog} from '@/components/ui/media-embed-dialog';
import {ELEMENT_BLOCKQUOTE, ELEMENT_H1, ELEMENT_H2, ELEMENT_H3} from '@/components/editor/plugins/basic-blocks';
import {ELEMENT_CODE_BLOCK} from '@/components/editor/plugins/code-block';
import {Transforms} from 'slate';

export function EditorToolbar() {
    const editor = useEditorRef();
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

    return (
        <FixedToolbar className="flex justify-start gap-1 rounded-t-lg">
            {/* Element Toolbar Buttons */}
            <ToolbarButton onClick={() => Transforms.setNodes(editor as any, {type: ELEMENT_H1} as any)}
                           tooltip="Heading 1 (⌘+Alt+1)">
                <Heading1 className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton onClick={() => Transforms.setNodes(editor as any, {type: ELEMENT_H2} as any)}
                           tooltip="Heading 2 (⌘+Alt+2)">
                <Heading2 className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton onClick={() => Transforms.setNodes(editor as any, {type: ELEMENT_H3} as any)}
                           tooltip="Heading 3 (⌘+Alt+3)">
                <Heading3 className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton onClick={() => Transforms.setNodes(editor as any, {type: ELEMENT_BLOCKQUOTE} as any)}
                           tooltip="Blockquote (⌘+Shift+.)">
                <Quote className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => {
                    // Callout 삽입
                    Transforms.insertNodes(editor as any, {
                        type: 'callout',
                        variant: 'info',
                        children: [{text: ''}]
                    } as any);
                }}
                tooltip="Callout"
            >
                <Info className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => {
                    // Code block 삽입
                    Transforms.insertNodes(editor as any, {
                        type: ELEMENT_CODE_BLOCK,
                        lang: 'javascript',
                        children: [{
                            type: 'code_line',
                            children: [{text: ''}]
                        }]
                    } as any);
                }}
                tooltip="Code Block"
            >
                <FileCode className="h-4 w-4"/>
            </ToolbarButton>

            {/* Separator */}
            <div className="mx-1 h-6 w-[1px] bg-border"/>

            {/* Column Layout Buttons */}
            <ToolbarButton
                onClick={() => {
                    // Insert 2-column layout
                    insertColumnGroup(editor, {columns: 2});
                }}
                tooltip="2 Columns"
            >
                <Columns2 className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => {
                    // Insert 3-column layout
                    insertColumnGroup(editor, {columns: 3});
                }}
                tooltip="3 Columns"
            >
                <Columns3 className="h-4 w-4"/>
            </ToolbarButton>

            {/* Separator */}
            <div className="mx-1 h-6 w-[1px] bg-border"/>

            {/* Table Buttons */}
            <ToolbarButton
                onClick={() => {
                    // Insert table dialog
                    const rows = prompt('행 수를 입력하세요:', '3');
                    const cols = prompt('열 수를 입력하세요:', '3');
                    const hasHeader = confirm('헤더 행을 포함하시겠습니까?');

                    if (rows && cols) {
                        insertTable(editor, {
                            rowCount: parseInt(rows),
                            colCount: parseInt(cols),
                            header: hasHeader
                        });
                    }
                }}
                tooltip="테이블 삽입"
            >
                <Table className="h-4 w-4"/>
            </ToolbarButton>

            {/* Separator */}
            <div className="mx-1 h-6 w-[1px] bg-border"/>

            {/* Mark Toolbar Buttons */}
            <MarkToolbarButton nodeType="bold" tooltip="Bold (⌘+B)">
                <Bold className="h-4 w-4"/>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="italic" tooltip="Italic (⌘+I)">
                <Italic className="h-4 w-4"/>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="underline" tooltip="Underline (⌘+U)">
                <Underline className="h-4 w-4"/>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="strikethrough" tooltip="Strikethrough (⌘+Shift+X)">
                <Strikethrough className="h-4 w-4"/>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="code" tooltip="Code (⌘+E)">
                <Code className="h-4 w-4"/>
            </MarkToolbarButton>
            <MarkToolbarButton nodeType="highlight" tooltip="Highlight (⌘+Shift+H)">
                <Highlighter className="h-4 w-4"/>
            </MarkToolbarButton>

            {/* Separator */}
            <div className="mx-1 h-6 w-[1px] bg-border"/>

            {/* Media Buttons */}
            <ToolbarButton
                onClick={() => setImageDialogOpen(true)}
                tooltip="이미지"
            >
                <ImageIcon className="h-4 w-4"/>
            </ToolbarButton>
            <ToolbarButton
                onClick={() => setMediaDialogOpen(true)}
                tooltip="동영상"
            >
                <Video className="h-4 w-4"/>
            </ToolbarButton>

            {/* Dialogs */}
            <ImageUploadDialog
                open={imageDialogOpen}
                onOpenChange={setImageDialogOpen}
                onInsert={(url, alt) => {
                    // Plate.js의 insertImage 함수 사용
                    Transforms.insertNodes(editor as any, {
                        type: 'img',
                        url,
                        alt: alt || '',
                        children: [{text: ''}]
                    } as any);
                }}
            />

            <MediaEmbedDialog
                open={mediaDialogOpen}
                onOpenChange={setMediaDialogOpen}
                onInsert={(url) => {
                    // Media embed 삽입
                    Transforms.insertNodes(editor as any, {
                        type: 'media_embed',
                        url,
                        children: [{text: ''}]
                    } as any);
                }}
            />
        </FixedToolbar>
    );
}
