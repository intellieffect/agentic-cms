'use client';

import React from 'react';
import {cn} from '@/lib/utils';

export const TableElement = React.forwardRef<
    HTMLTableElement,
    any
>(({className, children, ...props}, ref) => {
    return (
        <div className={cn('my-6 relative group', className)}>
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table
                    ref={ref}
                    className="w-full border-collapse"
                    {...props}
                >
                    {children}
                </table>
            </div>
        </div>
    );
});

TableElement.displayName = 'TableElement';