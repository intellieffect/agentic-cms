'use client';

import * as React from 'react';

import type { PlateElementProps } from 'platejs/react';

import { PlateElement } from 'platejs/react';

import { cn } from '@/lib/utils';

export function TableElement({ className, children, ...props }: PlateElementProps) {
  return (
    <div className={cn('my-6 relative group', className)}>
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <PlateElement {...props} as="table" className="w-full border-collapse">
          {children}
        </PlateElement>
      </div>
    </div>
  );
}
