'use client';

import React from 'react';
import {cn} from '@/lib/utils';
import {PlateElement, PlateElementProps, PlateLeaf, PlateLeafProps} from 'platejs/react';

// Re-export from the new location
export {CodeBlockElement} from '@/components/editor/plugins/code-block/code-block-element';

// Simple Code Line Element
export const CodeLineElement = React.forwardRef<
    HTMLDivElement,
    PlateElementProps
>(({className, children, element, ...props}, ref) => {
    return (
        <PlateElement
            ref={ref}
            element={element}
            className={cn('relative', className)}
            {...props}
        >
            {children}
        </PlateElement>
    );
});

CodeLineElement.displayName = 'CodeLineElement';

// Code Syntax Leaf for syntax highlighting
export const CodeSyntaxLeaf = React.forwardRef<
    HTMLSpanElement,
    PlateLeafProps
>(({className, children, leaf, ...props}, ref) => {
    const { ['codeSyntax.tokenType']: tokenType } = leaf as any;
    
    // Map lowlight token types to CSS classes
    const tokenStyles: Record<string, string> = {
        'comment': 'text-gray-500',
        'prolog': 'text-gray-500',
        'doctype': 'text-gray-500',
        'cdata': 'text-gray-500',
        'punctuation': 'text-gray-700',
        'property': 'text-red-600',
        'tag': 'text-red-600',
        'boolean': 'text-red-600',
        'number': 'text-cyan-600',
        'constant': 'text-red-600',
        'symbol': 'text-red-600',
        'deleted': 'text-red-600',
        'selector': 'text-green-600',
        'attr-name': 'text-green-600',
        'string': 'text-green-600',
        'char': 'text-green-600',
        'builtin': 'text-green-600',
        'inserted': 'text-green-600',
        'operator': 'text-orange-600',
        'entity': 'text-orange-600',
        'url': 'text-orange-600',
        'atrule': 'text-blue-600',
        'attr-value': 'text-blue-600',
        'keyword': 'text-purple-600',
        'function': 'text-blue-600',
        'class-name': 'text-purple-600',
        'regex': 'text-orange-600',
        'important': 'text-orange-600',
        'variable': 'text-orange-600',
        'bold': 'font-bold',
        'italic': 'italic',
    };
    
    const tokenClass = tokenType && tokenStyles[tokenType] ? tokenStyles[tokenType] : 'text-gray-900';
    
    return (
        <PlateLeaf
            ref={ref}
            leaf={leaf}
            {...props}
        >
            <span className={cn('font-mono text-sm', tokenClass, className)}>
                {children}
            </span>
        </PlateLeaf>
    );
});

CodeSyntaxLeaf.displayName = 'CodeSyntaxLeaf';
