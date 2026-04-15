'use client';

import React, {useState} from 'react';
import {cn} from '@/lib/utils';
import {PlateElement, PlateElementProps, useEditorRef} from 'platejs/react';
import {Check, Copy} from 'lucide-react';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from '@/components/ui/select';
import {Button} from '@/components/ui/button';
import {Transforms} from 'slate';
import {ReactEditor} from 'slate-react';

const LANGUAGES = [
    {value: 'javascript', label: 'JavaScript'},
    {value: 'typescript', label: 'TypeScript'},
    {value: 'jsx', label: 'JSX'},
    {value: 'tsx', label: 'TSX'},
    {value: 'python', label: 'Python'},
    {value: 'java', label: 'Java'},
    {value: 'csharp', label: 'C#'},
    {value: 'cpp', label: 'C++'},
    {value: 'go', label: 'Go'},
    {value: 'rust', label: 'Rust'},
    {value: 'php', label: 'PHP'},
    {value: 'ruby', label: 'Ruby'},
    {value: 'swift', label: 'Swift'},
    {value: 'kotlin', label: 'Kotlin'},
    {value: 'sql', label: 'SQL'},
    {value: 'html', label: 'HTML'},
    {value: 'css', label: 'CSS'},
    {value: 'scss', label: 'SCSS'},
    {value: 'json', label: 'JSON'},
    {value: 'yaml', label: 'YAML'},
    {value: 'markdown', label: 'Markdown'},
    {value: 'bash', label: 'Bash'},
    {value: 'shell', label: 'Shell'},
    {value: 'plaintext', label: 'Plain Text'},
];

export const CodeBlockElement = React.forwardRef<
    HTMLPreElement,
    PlateElementProps
>(({className, children, element, ...props}, ref) => {
    const editor = useEditorRef();
    const [copied, setCopied] = useState(false);
    const language = (element as any)?.lang || 'plaintext';

    const handleLanguageChange = (newLanguage: string) => {
        try {
            const path = ReactEditor.findPath(editor as any, element);
            Transforms.setNodes(editor as any, {lang: newLanguage} as any, {at: path});
        } catch (error) {
            console.error('Error changing language:', error);
        }
    };

    const handleCopy = () => {
        const codeContent = (element as any).children
            ?.map((line: any) => line.children?.map((child: any) => child.text).join(''))
            .join('\n');

        if (codeContent) {
            navigator.clipboard.writeText(codeContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <PlateElement
            ref={ref}
            element={element}
            className={cn(
                'relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50',
                className
            )}
            {...props}
        >
      <pre className="m-0 bg-transparent">
        {/* Header */}
          <div
              className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-4 py-2">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger
                className="h-8 w-[140px] border-0 bg-transparent text-xs font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900">
              <SelectValue placeholder="Select language"/>
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value} className="text-xs">
                      {lang.label}
                  </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2 text-xs text-gray-700 hover:bg-gray-200 hover:text-gray-900"
          >
            {copied ? (
                <>
                    <Check className="mr-1 h-3 w-3"/>
                    Copied!
                </>
            ) : (
                <>
                    <Copy className="mr-1 h-3 w-3"/>
                    Copy
                </>
            )}
          </Button>
        </div>

          {/* Code content */}
          <div className="overflow-x-auto bg-gray-50">
            <code className="block p-4 font-mono text-sm leading-relaxed text-gray-900">
              {children}
            </code>
          </div>
      </pre>
        </PlateElement>
    );
});

CodeBlockElement.displayName = 'CodeBlockElement';
