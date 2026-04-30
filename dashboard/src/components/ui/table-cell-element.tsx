'use client';

import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { PlateElement } from 'platejs/react';

import { cn } from '@/lib/utils';

export function TableCellElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="td"
      className={cn(
        'px-4 py-3 text-sm text-gray-700 border-b border-gray-100 relative',
        'transition-colors hover:bg-gray-50/50',
        className,
      )}
    >
      {children}
    </PlateElement>
  );
}

export function TableCellHeaderElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="th"
      className={cn(
        'px-4 py-3 text-sm font-medium text-gray-900 bg-gray-50/70',
        'border-b border-gray-200 text-left relative',
        className,
      )}
    >
      {children}
    </PlateElement>
  );
}
