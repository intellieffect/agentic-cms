'use client';

import { useState } from 'react';
import { Plate, usePlateEditor } from 'platejs/react';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BasicBlocksKit } from '@/components/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/components/editor/plugins/basic-marks-kit';
import { CalloutKit } from '@/components/editor/plugins/callout-kit';
import { CodeBlockKit } from '@/components/editor/plugins/code-block-kit';
import { ColumnKit } from '@/components/editor/plugins/column-kit';
import { NodeIdKit } from '@/components/editor/plugins/node-id-kit';
import { MediaKit } from '@/components/editor/plugins/media-kit';
import { TableKit } from '@/components/editor/plugins/table-kit';
import { ListKit } from '@/components/editor/plugins/list-kit';
import { LinkKit } from '@/components/editor/plugins/link-kit';
import { EditorToolbar } from '@/components/blog/editor-toolbar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EditorTextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  [key: string]: unknown;
}

interface EditorElementNode {
  type: string;
  children: Array<EditorElementNode | EditorTextNode>;
  [key: string]: unknown;
}

/**
 * Iterative DFS — content tree 안의 data:image base64 embed를 안전하게 검출.
 * regex `body.match`는 거대 string에서 V8 stack overflow 일으킴 (사용자 보고 회귀).
 */
function findDataImageEmbeds(node: unknown): { count: number; totalBytes: number } {
  let count = 0;
  let totalBytes = 0;
  const visited = new WeakSet<object>();
  const stack: unknown[] = [node];
  while (stack.length > 0) {
    const n = stack.pop();
    if (n === null || typeof n !== 'object') continue;
    if (visited.has(n as object)) continue;
    visited.add(n as object);
    if (Array.isArray(n)) {
      for (let i = n.length - 1; i >= 0; i--) stack.push(n[i]);
      continue;
    }
    for (const [key, val] of Object.entries(n as Record<string, unknown>)) {
      if ((key === 'url' || key === 'src') && typeof val === 'string' && val.startsWith('data:image/')) {
        count++;
        totalBytes += val.length;
      } else if (val !== null && typeof val === 'object') {
        stack.push(val);
      }
    }
  }
  return { count, totalBytes };
}

interface BlogManageEditorProps {
  postId: string;
  initialContent: EditorElementNode[];
  onSave?: () => void;
  onCancel?: () => void;
}

const blogEditorClassName = [
  'min-h-[400px] text-foreground',
  '[&_p]:mb-6 [&_p]:text-[17px] [&_p]:leading-8 [&_p]:text-foreground [&_p:last-child]:mb-0',
  '[&_h2]:mb-5 [&_h2]:mt-14 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight md:[&_h2]:mt-16 md:[&_h2]:mb-6',
  '[&_h3]:mb-4 [&_h3]:mt-10 [&_h3]:text-xl [&_h3]:font-bold md:[&_h3]:mt-12 md:[&_h3]:mb-5',
  '[&_h4]:mb-3 [&_h4]:mt-8 [&_h4]:text-lg [&_h4]:font-bold md:[&_h4]:mt-9 md:[&_h4]:mb-4',
  '[&_h5]:mb-3 [&_h5]:mt-6 [&_h5]:text-base [&_h5]:font-bold md:[&_h5]:mt-7',
  '[&_ul]:my-8 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:text-foreground md:[&_ul]:my-9',
  '[&_ol]:my-8 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:text-foreground md:[&_ol]:my-9',
  '[&_li]:text-base [&_li]:leading-8 [&_li]:text-foreground [&_li::marker]:text-foreground',
  '[&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-[#FF6B35] [&_blockquote]:bg-secondary/50 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:italic [&_blockquote]:text-foreground md:[&_blockquote]:my-10',
  '[&_a]:text-foreground [&_a]:underline [&_a]:transition-colors [&_a]:hover:text-foreground/80',
  '[&_hr]:my-10 [&_hr]:border-border md:[&_hr]:my-12',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-border',
  '[&_th]:border [&_th]:border-border [&_th]:bg-secondary [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold [&_th]:align-top',
  '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_td]:align-top',
  '[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-card',
  '[&_pre_code]:block [&_pre_code]:p-4 [&_pre_code]:font-mono [&_pre_code]:text-sm [&_pre_code]:leading-relaxed [&_pre_code]:text-foreground',
  '[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-secondary [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-sm',
].join(" ");

export function BlogManageEditor({ postId, initialContent, onSave, onCancel }: BlogManageEditorProps) {
  const [saving, setSaving] = useState(false);

  const editor = usePlateEditor({
    plugins: [
      ...NodeIdKit,
      ...BasicMarksKit,
      ...BasicBlocksKit,
      ...CalloutKit,
      ...CodeBlockKit,
      ...ColumnKit,
      ...MediaKit,
      ...TableKit,
      ...ListKit,
      ...LinkKit,
    ],
    value: initialContent?.length > 0 ? initialContent : [{ type: 'p', children: [{ text: '' }] }],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const content = editor.children;
      // base64 image embed 검사 — iterative DFS (regex match는 거대 string에서 V8 stack overflow)
      const embeds = findDataImageEmbeds(content);
      if (embeds.totalBytes > 0) {
        console.warn(`[BlogManageEditor] base64 image embeds: ${embeds.count}개, 합계 ${(embeds.totalBytes / 1024).toFixed(1)} KB`);
      }
      const body = JSON.stringify({ content, skipPublishedAt: true });
      console.log(`[BlogManageEditor] PUT body size: ${(body.length / 1024).toFixed(1)} KB`);
      const res = await fetch(`/api/blog-manage/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const data: { error?: string; stack?: string } = await res.json().catch(() => ({}));
        if (data.stack) console.error('[BlogManageEditor] server stack:', data.stack);
        throw new Error(data.error || `저장 실패 (HTTP ${res.status})`);
      }
      toast.success('저장되었습니다.');
      onSave?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
      toast.error(msg);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-3 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          미리보기
        </Button>
        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
      <TooltipProvider>
        <Plate editor={editor}>
          <EditorToolbar />
          <EditorContainer className="min-h-[400px] rounded-md border border-[#333] bg-[#0a0a0a] text-foreground">
            <Editor
              placeholder="콘텐츠를 작성하세요..."
              variant="default"
              className={blogEditorClassName}
            />
          </EditorContainer>
        </Plate>
      </TooltipProvider>
    </div>
  );
}
