'use client';

import React, {useState} from 'react';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Loader2} from 'lucide-react';
import {toast} from 'sonner';

interface ImageUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInsert: (url: string, alt?: string) => void;
}

export function ImageUploadDialog({open, onOpenChange, onInsert}: ImageUploadDialogProps) {
    const [uploading, setUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [altText, setAltText] = useState('');

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '업로드 실패');
            }

            const data = await response.json();
            setImageUrl(data.url);
            toast.success('이미지가 업로드되었습니다.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '이미지 업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const handleInsert = () => {
        if (!imageUrl) {
            toast.error('이미지 URL을 입력해주세요.');
            return;
        }

        onInsert(imageUrl, altText);
        onOpenChange(false);

        // 초기화
        setImageUrl('');
        setAltText('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>이미지 삽입</DialogTitle>
                    <DialogDescription>
                        이미지를 업로드하거나 URL을 입력하세요.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload">업로드</TabsTrigger>
                        <TabsTrigger value="url">URL</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="file">이미지 파일</Label>
                            <div className="flex items-center space-x-2">
                                <Input
                                    id="file"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                                {uploading && <Loader2 className="h-4 w-4 animate-spin"/>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                JPG, PNG, GIF, WebP (최대 10MB)
                            </p>
                        </div>

                        {imageUrl && (
                            <div className="space-y-2">
                                <Label>미리보기</Label>
                                <img src={imageUrl} alt="Preview" className="max-w-full h-auto rounded-md"/>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="url" className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="url">이미지 URL</Label>
                            <Input
                                id="url"
                                type="url"
                                placeholder="https://example.com/image.jpg"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                            />
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="space-y-2">
                    <Label htmlFor="alt">대체 텍스트 (선택)</Label>
                    <Input
                        id="alt"
                        placeholder="이미지 설명"
                        value={altText}
                        onChange={(e) => setAltText(e.target.value)}
                    />
                </div>

                <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        취소
                    </Button>
                    <Button onClick={handleInsert} disabled={!imageUrl || uploading}>
                        삽입
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
