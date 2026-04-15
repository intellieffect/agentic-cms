'use client';

import React from 'react';
import {cn} from '@/lib/utils';
import {PlateElement, PlateElementProps, useEditorRef, useElement} from 'platejs/react';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {Button} from '@/components/ui/button';
import {Columns2, Columns3, Columns4, GripVertical} from 'lucide-react';
import {setColumns} from '@platejs/layout';

// Column Group Element (container for columns)
export const ColumnGroupElement = React.forwardRef<
    HTMLDivElement,
    PlateElementProps
>(({className, children, element, ...props}, ref) => {
    const editor = useEditorRef();
    const path = editor.api.findPath(element);

    const handleLayoutChange = (columns: number) => {
        if (path) {
            setColumns(editor, {at: path, columns});
        }
    };

    return (
        <PlateElement
            ref={ref}
            element={element}
            className={cn(
                'relative my-4',
                className
            )}
            {...props}
        >
            {/* Column Layout Selector */}
            <div className="absolute -top-10 right-0 opacity-0 hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                            <Columns3 className="h-4 w-4 mr-1"/>
                            Layout
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleLayoutChange(2)}>
                            <Columns2 className="h-4 w-4 mr-2"/>
                            2 Columns
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLayoutChange(3)}>
                            <Columns3 className="h-4 w-4 mr-2"/>
                            3 Columns
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleLayoutChange(4)}>
                            <Columns4 className="h-4 w-4 mr-2"/>
                            4 Columns
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex gap-4">
                {children}
            </div>
        </PlateElement>
    );
});

ColumnGroupElement.displayName = 'ColumnGroupElement';

// Individual Column Element
export const ColumnElement = React.forwardRef<
    HTMLDivElement,
    PlateElementProps
>(({className, children, element, ...props}, ref) => {
    const [isResizing, setIsResizing] = React.useState(false);
    const columnElement = useElement();
    const width = (columnElement as any).width || '50%';

    return (
        <PlateElement
            ref={ref}
            element={element}
            className={cn(
                'relative flex-1 px-3',
                'border-l first:border-l-0 border-gray-200 dark:border-gray-800',
                className
            )}
            style={{width}}
            {...props}
        >
            {/* Resize Handle */}
            <div
                className={cn(
                    'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors',
                    'flex items-center justify-center',
                    isResizing && 'bg-blue-500'
                )}
                onMouseDown={(e) => {
                    e.preventDefault();
                    setIsResizing(true);
                    // TODO: Implement resize logic
                }}
            >
                <GripVertical className="h-4 w-4 text-gray-400"/>
            </div>

            {children}
        </PlateElement>
    );
});

ColumnElement.displayName = 'ColumnElement';
