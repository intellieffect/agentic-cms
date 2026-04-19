import { PlateNode } from './plate.js';
import type { ValidationIssue } from './validation.js';
/**
 * 블로그 카테고리
 */
export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    created_at?: string;
    updated_at?: string;
}
/**
 * 블로그 태그
 */
export interface BlogTag {
    id: string;
    name: string;
    slug: string;
    usage_count?: number;
    created_at?: string;
    updated_at?: string;
}
/**
 * 블로그 포스트
 */
export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    content: PlateNode[];
    excerpt?: string;
    status: BlogPostStatus;
    created_at: string;
    updated_at: string;
    published_at?: string;
    seo_title?: string;
    meta_description?: string;
    thumbnail_url?: string;
    thumbnail_alt?: string;
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    categories?: BlogCategory[];
    tags?: BlogTag[];
    metadata?: BlogPostMetadata;
}
/**
 * 블로그 포스트 상태
 */
export type BlogPostStatus = 'draft' | 'published' | 'archived';
/**
 * 블로그 포스트 메타데이터
 */
export interface BlogPostMetadata {
    reading_time?: number;
    word_count?: number;
    next_topic_hint?: string;
    seo_score?: number;
    keyword_density?: Record<string, number>;
    [key: string]: any;
}
/**
 * 블로그 포스트 카테고리 관계
 */
export interface BlogPostCategory {
    id: string;
    post_id: string;
    category_id: string;
    created_at?: string;
    category?: BlogCategory;
}
/**
 * 블로그 포스트 태그 관계
 */
export interface BlogPostTag {
    id: string;
    post_id: string;
    tag_id: string;
    created_at?: string;
    tag?: BlogTag;
}
/**
 * 블로그 검증 결과
 */
export interface BlogValidationResult {
    id: string;
    post_id: string;
    score: number;
    issues: ValidationIssue[];
    metadata?: Record<string, any>;
    created_at: string;
}
/**
 * 블로그 생성 요청
 */
export interface CreateBlogPostRequest {
    title: string;
    content: string | PlateNode[];
    category: string;
    tags?: string[];
    status?: BlogPostStatus;
    seo_title?: string;
    meta_description?: string;
    thumbnail_url?: string;
    thumbnail_alt?: string;
}
/**
 * 블로그 업데이트 요청
 */
export interface UpdateBlogPostRequest {
    title?: string;
    content?: PlateNode[];
    excerpt?: string;
    status?: BlogPostStatus;
    seo_title?: string;
    meta_description?: string;
    thumbnail_url?: string;
    thumbnail_alt?: string;
    categories?: string[];
    tags?: string[];
}
/**
 * 카테고리 통계
 */
export interface CategoryStats {
    category: BlogCategory;
    post_count: number;
    latest_post?: {
        id: string;
        title: string;
        created_at: string;
    };
}
/**
 * 태그 추천
 */
export interface TagRecommendation {
    tag: string;
    relevance: number;
    reason: string;
}
/**
 * SEO 분석 결과
 */
export interface SEOAnalysis {
    score: number;
    title_score: number;
    meta_description_score: number;
    content_score: number;
    keyword_density: Record<string, number>;
    issues: string[];
    suggestions: string[];
}
export interface SimpleCategoryStats {
    id: string;
    name: string;
    slug: string;
    postCount: number;
    status: string;
    percentage: number;
    needsContent: boolean;
}
export interface SuggestedTopic {
    title: string;
    description?: string;
    keywords: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
    expectedViews: 'low' | 'medium' | 'high' | 'very-high';
    trendScore: number;
    suggestedTags?: string[];
    isUnique?: boolean;
    category?: string;
    searchResultSource?: string;
    publishedDate?: string;
}
export interface SearchResult {
    title: string;
    snippet: string;
    url: string;
    date?: string;
}
//# sourceMappingURL=blog.d.ts.map