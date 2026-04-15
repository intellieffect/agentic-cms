'use client';

import React from 'react';
import {cn} from '@/lib/utils';

export const TableRowElement = React.forwardRef<
    HTMLTableRowElement,
    any
>(({className, children, ...props}, ref) => {
    return (
        <tr
            ref={ref}
            className={cn(
                'transition-colors hover:bg-gray-50/30',
                'border-b border-gray-100 last:border-0',
                className
            )}
            {...props}
        >
            {children}
        </tr>
    );
});

TableRowElement.displayName = 'TableRowElement';