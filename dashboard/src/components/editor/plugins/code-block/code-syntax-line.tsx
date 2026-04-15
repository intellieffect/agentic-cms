'use client';

import React from 'react';
import {cn} from '@/lib/utils';
import {PlateElement, PlateElementProps} from 'platejs/react';

export const CodeSyntaxLine = React.forwardRef<
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

CodeSyntaxLine.displayName = 'CodeSyntaxLine';
