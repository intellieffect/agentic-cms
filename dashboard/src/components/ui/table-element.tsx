'use client';

import React from 'react';
import {cn} from '@/lib/utils';

export const TableElement = React.forwardRef<
    HTMLTableElement,
    any
>(({className, children, ...props}, ref) => {
    const {
        editor, element, nodeProps, path, attributes, root, rootProps,
        setOption, getOption, getOptions, setOptions, mergeOptions,
        blockSelectionOptions,
        ...domProps
    } = props as any;
    return (
        <div className={cn('my-6 relative group', className)}>
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table
                    {...(attributes ?? {})}
                    {...domProps}
                    ref={ref}
                    className="w-full border-collapse"
                >
                    {children}
                </table>
            </div>
        </div>
    );
});

TableElement.displayName = 'TableElement';