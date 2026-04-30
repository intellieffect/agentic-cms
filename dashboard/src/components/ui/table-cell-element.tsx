'use client';

import React from 'react';
import {cn} from '@/lib/utils';

export const TableCellElement = React.forwardRef<
    HTMLTableCellElement,
    any
>(({className, children, ...props}, ref) => {
    const {
        editor, element, nodeProps, path, attributes, root, rootProps,
        setOption, getOption, getOptions, setOptions, mergeOptions,
        blockSelectionOptions,
        ...domProps
    } = props as any;
    return (
        <td
            {...(attributes ?? {})}
            {...domProps}
            ref={ref}
            className={cn(
                'px-4 py-3 text-sm text-gray-700 border-b border-gray-100 relative',
                'transition-colors hover:bg-gray-50/50',
                className
            )}
        >
            {children}
        </td>
    );
});

TableCellElement.displayName = 'TableCellElement';

export const TableCellHeaderElement = React.forwardRef<
    HTMLTableCellElement,
    any
>(({className, children, ...props}, ref) => {
    const {
        editor, element, nodeProps, path, attributes, root, rootProps,
        setOption, getOption, getOptions, setOptions, mergeOptions,
        blockSelectionOptions,
        ...domProps
    } = props as any;
    return (
        <th
            {...(attributes ?? {})}
            {...domProps}
            ref={ref}
            className={cn(
                'px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50/70',
                'border-b border-gray-200 text-left relative',
                className
            )}
        >
            {children}
        </th>
    );
});

TableCellHeaderElement.displayName = 'TableCellHeaderElement';