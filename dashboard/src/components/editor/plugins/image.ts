import { Transforms, Editor, Element as SlateElement } from 'slate';
import { ReactEditor } from 'slate-react';

export const ELEMENT_IMAGE = 'image';

export interface ImageElement {
  type: 'image';
  url: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  children: any[];
}

// 이미지 삽입
export const insertImage = (editor: Editor, url: string, alt?: string) => {
  const image: ImageElement = {
    type: ELEMENT_IMAGE,
    url,
    alt: alt || '',
    children: [{ text: '' }],
  };
  
  Transforms.insertNodes(editor, image);
  Transforms.insertNodes(editor, {
    type: 'paragraph',
    children: [{ text: '' }],
  } as any);
};

// 이미지 업로드 핸들러 - Supabase Storage 사용
export const uploadImage = async (file: File): Promise<string> => {
  try {
    const { getSupabase } = await import('@/lib/supabase');
    const supabase = getSupabase();
    
    // 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `blog-images/${fileName}`;
    
    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('content-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    // 공개 URL 가져오기
    const { data: { publicUrl } } = supabase.storage
      .from('content-media')
      .getPublicUrl(filePath);
    
    return publicUrl;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
};

// 이미지 파일 검증
export const isImageFile = (file: File): boolean => {
  const acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  return acceptedTypes.includes(file.type);
};

// 클립보드에서 이미지 붙여넣기 처리
export const handleImagePaste = async (
  editor: Editor,
  event: React.ClipboardEvent
): Promise<boolean> => {
  const files = Array.from(event.clipboardData.files);
  const imageFile = files.find(isImageFile);
  
  if (imageFile) {
    event.preventDefault();
    
    try {
      const url = await uploadImage(imageFile);
      insertImage(editor, url, imageFile.name);
      return true;
    } catch (error) {
      console.error('Failed to upload image:', error);
      return false;
    }
  }
  
  return false;
};

// 드래그 앤 드롭으로 이미지 업로드
export const handleImageDrop = async (
  editor: Editor,
  event: React.DragEvent
): Promise<boolean> => {
  const files = Array.from(event.dataTransfer.files);
  const imageFiles = files.filter(isImageFile);
  
  if (imageFiles.length > 0) {
    event.preventDefault();
    
    for (const file of imageFiles) {
      try {
        const url = await uploadImage(file);
        insertImage(editor, url, file.name);
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    }
    
    return true;
  }
  
  return false;
};
