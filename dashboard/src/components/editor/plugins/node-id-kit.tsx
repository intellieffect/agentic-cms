'use client';

import {createPlatePlugin} from 'platejs/react';
import {Transforms} from 'slate';

// Simple ID generator
const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const NodeIdPlugin = createPlatePlugin({
    key: 'nodeId',
    extendEditor: ({editor}) => {
        const {normalizeNode} = editor as any;

        editor.normalizeNode = (entry: any) => {
            const [node, path] = entry;

            // Add ID to nodes that don't have one
            if (!node.id && path.length > 0) {
                const id = generateId();
                Transforms.setNodes(
                    editor as any,
                    {id} as any,
                    {at: path}
                );
                return;
            }

            normalizeNode(entry);
        };

        return editor;
    },
});

export const NodeIdKit = [NodeIdPlugin];
