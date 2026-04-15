'use client';

import {CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin,} from '@platejs/code-block/react';
import {all, createLowlight} from 'lowlight';

import {CodeBlockElement, CodeLineElement, CodeSyntaxLeaf,} from '@/components/ui/code-block-node';

const lowlight = createLowlight(all);

export const CodeBlockKit = [
    CodeBlockPlugin.configure({
        node: {component: CodeBlockElement},
        options: {
            lowlight,
            defaultLanguage: 'plaintext',
        },
        shortcuts: {
            toggle: {
                keys: [['mod+alt+8'], ['mod+shift+c']]
            }
        },
    }),
    CodeLinePlugin.configure({
        node: {component: CodeLineElement},
    }),
    CodeSyntaxPlugin.configure({
        node: {component: CodeSyntaxLeaf},
    }),
];
