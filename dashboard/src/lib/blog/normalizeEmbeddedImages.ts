import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "content-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class EmbeddedImageNormalizationError extends Error {
  uploadedPaths: string[];

  constructor(message: string, uploadedPaths: string[]) {
    super(message);
    this.name = "EmbeddedImageNormalizationError";
    this.uploadedPaths = [...uploadedPaths];
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDataImageUrl(value: string): { mimeType: string; buffer: Buffer } | null {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const base64 = match[2];
  const ext = SUPPORTED_IMAGE_TYPES[mimeType];
  if (!ext) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${mimeType}`);
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("비어 있는 이미지 데이터입니다.");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`이미지 크기 제한(${MAX_IMAGE_BYTES} bytes)을 초과했습니다.`);
  }

  return { mimeType, buffer };
}

async function uploadDataImage(
  supabase: SupabaseClient,
  postId: string,
  dataUrl: string,
  uploadedPaths: string[]
): Promise<string> {
  const parsed = parseDataImageUrl(dataUrl);
  if (!parsed) return dataUrl;

  const ext = SUPPORTED_IMAGE_TYPES[parsed.mimeType];
  const filePath = `blog-images/${postId}/${Date.now()}-${randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, parsed.buffer, {
    contentType: parsed.mimeType,
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(`이미지 업로드 실패: ${error.message}`);
  }

  uploadedPaths.push(filePath);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

const MAX_NODES_VISITED = 200_000;

interface DataImageRef {
  node: Record<string, unknown>;
  key: string;
  url: string;
}

/**
 * Iterative DFS — collect data:image refs without recursion.
 * 재귀 버전은 Plate editor.children 같은 깊은 트리에서 stack overflow 발생.
 * Iterative + visited Set + cap으로 cycle/너무 큰 트리 방어.
 */
function collectDataImageRefs(content: unknown): DataImageRef[] {
  const refs: DataImageRef[] = [];
  const visited = new WeakSet<object>();
  const stack: unknown[] = [content];
  let count = 0;

  while (stack.length > 0) {
    if (count++ > MAX_NODES_VISITED) {
      console.warn(`[normalize] visited cap ${MAX_NODES_VISITED} reached — content tree too large or cyclic`);
      break;
    }

    const node = stack.pop();
    if (node === null || typeof node !== "object") continue;
    if (visited.has(node as object)) continue;
    visited.add(node as object);

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const item = node[i];
        if (item !== null && typeof item === "object") stack.push(item);
      }
      continue;
    }

    for (const [key, child] of Object.entries(node)) {
      if ((key === "url" || key === "src") && typeof child === "string" && child.startsWith("data:image/")) {
        refs.push({ node: node as Record<string, unknown>, key, url: child });
        continue;
      }
      if (child !== null && typeof child === "object") {
        stack.push(child);
      }
    }
  }

  return refs;
}

export async function normalizeEmbeddedImagesInContent(
  supabase: SupabaseClient,
  postId: string,
  content: unknown
): Promise<{ content: unknown; uploadedPaths: string[] }> {
  const uploadedPaths: string[] = [];
  const refs = collectDataImageRefs(content);

  if (refs.length === 0) {
    return { content, uploadedPaths };
  }

  try {
    // 모든 data:image 업로드를 병렬로 + in-place 치환
    await Promise.all(
      refs.map(async (ref) => {
        const newUrl = await uploadDataImage(supabase, postId, ref.url, uploadedPaths);
        ref.node[ref.key] = newUrl;
      })
    );
    return { content, uploadedPaths };
  } catch (error) {
    const message = error instanceof Error ? error.message : "본문 이미지 정규화에 실패했습니다.";
    throw new EmbeddedImageNormalizationError(message, uploadedPaths);
  }
}

export async function cleanupUploadedImages(
  supabase: SupabaseClient,
  uploadedPaths: string[]
): Promise<void> {
  if (uploadedPaths.length === 0) return;
  const uniquePaths = Array.from(new Set(uploadedPaths));
  await supabase.storage.from(BUCKET).remove(uniquePaths);
}
