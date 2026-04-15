'use client';

import React from 'react';
import {cn} from '@/lib/utils';
import {PlateElement} from 'platejs/react';
import {X} from 'lucide-react';
import {useFocused, useSelected} from 'slate-react';
import {Button} from '@/components/ui/button';

export const ImageElement = ({className, children, ...props}: any) => {
    const {element} = props;
    const selected = useSelected();
    const focused = useFocused();

    return (
        <PlateElement className={cn('relative', className)} {...props}>
            <div contentEditable={false} className="relative">
                <img
                    src={element.url}
                    alt={element.alt || ''}
                    className={cn(
                        'block max-w-full h-auto rounded-lg',
                        selected && focused && 'ring-2 ring-blue-500'
                    )}
                />
                {selected && focused && (
                    <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => {
                            const editor = props.editor;
                            const path = props.path;
                            editor.deleteFragment();
                        }}
                    >
                        <X className="h-4 w-4"/>
                    </Button>
                )}
            </div>
            {children}
        </PlateElement>
    );
};
