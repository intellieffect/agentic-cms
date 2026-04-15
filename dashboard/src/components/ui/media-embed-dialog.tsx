'use client';

import React, {useState} from 'react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {toast} from 'sonner';

interface MediaEmbedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (url: string) => void;
}

export function MediaEmbedDialog({open, onOpenChange, onInsert}: MediaEmbedDialogProps) {
    const [mediaUrl, setMediaUrl] = useState('');

    const isValidUrl = (url: string) => {
        try {
            new URL(url);
            return true;
        } catch (error) {
            return false;
        }
    };

    const handleInsert = () => {
        if (!mediaUrl) {
            toast.error('URL을 입력해주세요.');
            return;
        }

        if (!isValidUrl(mediaUrl)) {
            toast.error('올바른 URL을 입력해주세요.');
            return;
        }

        onInsert(mediaUrl);
        onOpenChange(false);
        setMediaUrl('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>미디어 삽입</DialogTitle>
                    <DialogDescription>
                        YouTube, Vimeo 등의 미디어 URL을 입력하세요.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="mediaUrl">미디어 URL</Label>
                        <Input
                            id="mediaUrl"
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleInsert();
                                }
                            }}
                        />
                        <p className="text-sm text-muted-foreground">
                            YouTube, Vimeo 등의 동영상 URL을 지원합니다.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button onClick={handleInsert}>
                        삽입
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
