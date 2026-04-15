'use client';

import {ImagePlugin, MediaEmbedPlugin} from '@platejs/media/react';
import {ImageElement} from '@/components/ui/image-element';
import {MediaEmbedElement} from '@/components/ui/media-embed-element';

export const MediaKit = [
    ImagePlugin.withComponent(ImageElement),
    MediaEmbedPlugin.withComponent(MediaEmbedElement),
];
