'use client';

import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { PlateElement } from 'platejs/react';

import { cn } from '@/lib/utils';

export function TableRowElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      {...props}
      as="tr"
      className={cn(
        'transition-colors hover:bg-gray-50/30',
        'border-b border-gray-100 last:border-0',
        className,
      )}
    >
      {children}
    </PlateElement>
  );
}
