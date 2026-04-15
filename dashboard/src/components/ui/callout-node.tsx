'use client';

import {cn} from '@/lib/utils';
import {PlateElement, type PlateElementProps} from 'platejs/react';

export interface CalloutVariant {
    icon: string;
    className: string;
}

export const calloutVariants: Record<string, CalloutVariant> = {
    info: {
        icon: '💡',
        className: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    },
    warning: {
        icon: '⚠️',
        className: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    },
    error: {
        icon: '🚫',
        className: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
    },
    success: {
        icon: '✅',
        className: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    },
    note: {
        icon: '📝',
        className: 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800',
    },
};

export function CalloutElement({
                                   className,
                                   children,
                                   element,
                                   ...props
                               }: PlateElementProps) {
    // element가 undefined일 수 있으므로 안전하게 처리
    const variant = (element as any)?.variant as string || 'info';
    const icon = (element as any)?.icon as string || calloutVariants[variant]?.icon || '💡';
    const variantClassName = calloutVariants[variant]?.className || calloutVariants.info.className;

    return (
        <PlateElement
            element={element}
            className={cn(
                'my-4 flex gap-3 rounded-lg border p-4',
                variantClassName,
                className
            )}
            {...props}
        >
            <div className="text-xl leading-none" contentEditable={false}>
                {icon}
            </div>
            <div className="flex-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                {children}
            </div>
        </PlateElement>
    );
}
