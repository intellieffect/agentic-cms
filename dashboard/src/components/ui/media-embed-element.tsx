'use client';

import React from 'react';
import {cn} from '@/lib/utils';
import {PlateElement} from 'platejs/react';
import {X} from 'lucide-react';
import {useFocused, useSelected} from 'slate-react';
import {Button} from '@/components/ui/button';

export const MediaEmbedElement = ({className, children, ...props}: any) => {
    const {element} = props;
    const selected = useSelected();
    const focused = useFocused();

    // YouTube URL에서 비디오 ID 추출
    const getYouTubeId = (url: string) => {
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        return match ? match[1] : null;
    };

    const renderEmbed = () => {
        const url = element.url;

        // YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const videoId = getYouTubeId(url);
            if (videoId) {
                return (
                    <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        width="100%"
                        height="400"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg"
                    />
                );
            }
        }

        // 기타 iframe 지원 URL
        return (
            <iframe
                src={url}
                width="100%"
                height="400"
                frameBorder="0"
                className="rounded-lg"
            />
        );
    };

    return (
        <PlateElement className={cn('relative my-4', className)} {...props}>
            <div contentEditable={false} className="relative">
                <div className={cn(
                    'relative',
                    selected && focused && 'ring-2 ring-blue-500 rounded-lg'
                )}>
                    {renderEmbed()}
                </div>
                {selected && focused && (
                    <Button
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => {
                            const editor = props.editor;
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
