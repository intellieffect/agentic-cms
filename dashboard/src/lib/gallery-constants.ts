import type { GalleryKind, GalleryCoverAspect } from "./types";

export const GALLERY_IMAGE_MAX = 10 * 1024 * 1024;
export const GALLERY_VIDEO_MAX = 100 * 1024 * 1024;

export const GALLERY_KINDS: readonly GalleryKind[] = [
  "landing",
  "ad",
  "case_study",
  "ai_influencer",
  "research",
  "other",
] as const;

export const GALLERY_MEDIA_TYPES = ["all", "image", "video"] as const;
export type GalleryMediaType = (typeof GALLERY_MEDIA_TYPES)[number];

export const GALLERY_KIND_FILTERS: readonly (GalleryKind | "all")[] = [
  "all",
  ...GALLERY_KINDS,
] as const;

export const ALLOWED_GALLERY_KINDS = new Set<string>(GALLERY_KINDS);

export const GALLERY_COVER_ASPECTS: readonly GalleryCoverAspect[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:5",
  "3:4",
] as const;

export const ALLOWED_GALLERY_ASPECTS = new Set<string>(GALLERY_COVER_ASPECTS);
