/**
 * AWC Gallery 1회성 Seed 매니페스트
 *
 * ~/Downloads/awc-assets/ 의 파일을 Supabase Storage(content-media) 에 업로드하고
 * media + gallery_items + gallery_item_media 에 row 를 생성한다.
 *
 * 편집 가이드:
 *  - filename  : ~/Downloads/awc-assets/ 기준 상대 파일명 (공백 포함 그대로)
 *  - slug      : UNIQUE. 파일명 기반이지만 수동 편집 가능. /gallery/item/:slug
 *  - title     : 카드 상단·상세 페이지 제목
 *  - subtitle  : 카드 하단·상세 부제 (1줄)
 *  - kind      : 'landing' | 'video' | 'ad' | 'image' | 'carousel' | 'case_study' | 'other'
 *  - cover_aspect  : '1:1' | '16:9' | '9:16' | '4:5' | '3:4' (masonry 힌트)
 *  - duration_minutes  : "Agentic Workflow · N분" 카드 메타 — 실제 제작 소요 시간 추정
 *  - tags      : 필터·검색용 배열
 *  - is_featured : 랜딩 masonry 9개 후보 여부
 *  - featured_rank : is_featured=true 인 것들의 상대 정렬(작을수록 먼저). 10~20 권장
 *  - visibility : 'public' | 'member' | 'internal' — 기본 'public'
 *
 * 실행 전 Jin 확인 필요 사항:
 *  1. 각 title·subtitle·duration_minutes 현실 근사
 *  2. featured 후보 10~12개 선정
 *  3. (영상) cover_aspect 실 비율 (9:16 세로? 16:9 가로?)
 *
 * 실행:
 *  cd ~/Projects/agentic-cms
 *  SUPABASE_URL=https://euhxmmiqfyptvsvvbbvp.supabase.co \
 *  SUPABASE_SERVICE_ROLE_KEY=... \
 *  tsx scripts/seed-gallery.ts
 */

export type GallerySeedKind =
  | 'landing'
  | 'video'
  | 'ad'
  | 'image'
  | 'carousel'
  | 'case_study'
  | 'other';

export type GallerySeedAspect = '1:1' | '16:9' | '9:16' | '4:5' | '3:4';

export type GallerySeedVisibility = 'internal' | 'member' | 'public';

export interface GallerySeedItem {
  filename: string;              // ~/Downloads/awc-assets/<filename>
  slug: string;
  title: string;
  subtitle?: string;
  summary?: string;
  kind: GallerySeedKind;
  cover_aspect: GallerySeedAspect;
  duration_minutes: number;
  tags: string[];
  is_featured: boolean;
  featured_rank?: number;
  visibility?: GallerySeedVisibility; // default 'public'
  author?: string;                    // default 'Agentic Workflow'
}

/**
 * Phase 1 seed 매니페스트 — 18개 초안
 * (Jin 확정 후 실행. 없는 파일은 skip.)
 */
export const GALLERY_SEED: GallerySeedItem[] = [
  // ── LANDING 제작 (AI 랜딩페이지 시안) ─────────────────────────
  {
    filename: '03-3d-immersive.png',
    slug: 'altereal-immersive-form',
    title: 'Altereal — Immersive Form',
    subtitle: '3D 몰입형 랜딩 시안',
    kind: 'landing',
    cover_aspect: '16:9',
    duration_minutes: 14,
    tags: ['landing', '3d', 'art-direction'],
    is_featured: true,
    featured_rank: 10,
  },
  {
    filename: '01-y2k-maximalism.png',
    slug: 'cyber-pop-star-y2k',
    title: 'Cyber Pop Star',
    subtitle: 'Y2K 맥시멀리즘 랜딩 시안',
    kind: 'landing',
    cover_aspect: '16:9',
    duration_minutes: 11,
    tags: ['landing', 'y2k', 'retro'],
    is_featured: true,
    featured_rank: 20,
  },
  {
    filename: '02-neo-brutalism.png',
    slug: 'brutal-co-neo-brutalism',
    title: 'BRUTAL.CO · Break Grid',
    subtitle: 'Neo Brutalism 랜딩 시안',
    kind: 'landing',
    cover_aspect: '16:9',
    duration_minutes: 13,
    tags: ['landing', 'brutalism', 'bold'],
    is_featured: true,
    featured_rank: 30,
  },
  {
    filename: '08-gamification-dashboard.png',
    slug: 'awc-member-dashboard',
    title: 'AWC · Member Dashboard',
    subtitle: '게이미피케이션 멤버십 시안',
    kind: 'landing',
    cover_aspect: '16:9',
    duration_minutes: 18,
    tags: ['landing', 'gamification', 'dashboard', 'awc'],
    is_featured: true,
    featured_rank: 40,
  },

  // ── VIDEO (AI 랜딩 hero autoplay) ─────────────────────────
  {
    filename: 'prism-hero-autoplay.mp4',
    slug: 'prism-hero-autoplay',
    title: 'Prism · Hero Motion',
    subtitle: '랜딩 Hero Autoplay',
    kind: 'video',
    cover_aspect: '16:9',
    duration_minutes: 8,
    tags: ['video', 'hero', 'motion'],
    is_featured: true,
    featured_rank: 50,
  },
  {
    filename: 'mulae-hero-autoplay.mp4',
    slug: 'mulae-hero-autoplay',
    title: 'Mulae · Hero Motion',
    subtitle: '랜딩 Hero Autoplay',
    kind: 'video',
    cover_aspect: '16:9',
    duration_minutes: 9,
    tags: ['video', 'hero', 'motion'],
    is_featured: false,
  },
  {
    filename: 'parallel-hero-autoplay.mp4',
    slug: 'parallel-hero-autoplay',
    title: 'Parallel · Hero Motion',
    subtitle: '랜딩 Hero Autoplay',
    kind: 'video',
    cover_aspect: '16:9',
    duration_minutes: 9,
    tags: ['video', 'hero', 'motion'],
    is_featured: false,
  },
  {
    filename: 'vespr-hero-autoplay.mp4',
    slug: 'vespr-hero-autoplay',
    title: 'Vespr · Hero Motion',
    subtitle: '랜딩 Hero Autoplay',
    kind: 'video',
    cover_aspect: '16:9',
    duration_minutes: 10,
    tags: ['video', 'hero', 'motion'],
    is_featured: false,
  },

  // ── AD VIDEO (AI 인물+제품 합성 광고) ─────────────────────────
  {
    filename: 'miumiu-ad-v1.mp4',
    slug: 'miumiu-spring-edition',
    title: 'Miu Miu · Spring Edition',
    subtitle: '핸드백 광고 컷',
    kind: 'video',
    cover_aspect: '9:16',
    duration_minutes: 22,
    tags: ['ad', 'fashion', 'miumiu'],
    is_featured: true,
    featured_rank: 60,
  },
  {
    filename: 'wukong-ad-v2.mp4',
    slug: 'wukong-brand-film',
    title: 'Wukong · Brand Film',
    subtitle: '오공 브랜드 광고 영상',
    kind: 'video',
    cover_aspect: '16:9',
    duration_minutes: 16,
    tags: ['ad', 'brand-film'],
    is_featured: true,
    featured_rank: 70,
  },

  // ── AD IMAGE (AI 인물+제품 합성) ─────────────────────────
  {
    filename: 'image (5).png',
    slug: 'isoi-golden-timing',
    title: 'ISOI · Golden Timing',
    subtitle: 'Eye & Wrinkle Patch 광고 포스터',
    kind: 'ad',
    cover_aspect: '3:4',
    duration_minutes: 9,
    tags: ['ad', 'beauty', 'isoi'],
    is_featured: true,
    featured_rank: 80,
  },
  {
    filename: 'cut1-application.png',
    slug: 'dermuno-gym-routine',
    title: 'Dérmuno · Gym Routine',
    subtitle: '선크림 적용 컷',
    kind: 'ad',
    cover_aspect: '3:4',
    duration_minutes: 7,
    tags: ['ad', 'beauty', 'lifestyle'],
    is_featured: true,
    featured_rank: 90,
  },
  {
    filename: 'cut2-hero-product.png',
    slug: 'dermuno-hero-product',
    title: 'Dérmuno · Hero Cut',
    subtitle: '제품+인물 시선 컷',
    kind: 'ad',
    cover_aspect: '3:4',
    duration_minutes: 6,
    tags: ['ad', 'beauty'],
    is_featured: false,
  },
  {
    filename: 'image.png',
    slug: 'numbus-body-lotion',
    title: 'numbus · Body Lotion',
    subtitle: '인물+제품 컷',
    kind: 'ad',
    cover_aspect: '3:4',
    duration_minutes: 5,
    tags: ['ad', 'beauty'],
    is_featured: false,
  },

  // ── PRODUCT · IMAGE (AI 렌더) ─────────────────────────
  {
    filename: 'image (11).png',
    slug: 'miumiu-matelasse-wallet',
    title: 'Miu Miu · Matelassé Wallet',
    subtitle: '제품 클로즈업',
    kind: 'image',
    cover_aspect: '16:9',
    duration_minutes: 4,
    tags: ['product', 'fashion'],
    is_featured: false,
  },
  {
    filename: 'image (15).png',
    slug: 'han-river-penthouse',
    title: 'Han-River Penthouse',
    subtitle: '프리미엄 인테리어 렌더',
    kind: 'image',
    cover_aspect: '16:9',
    duration_minutes: 12,
    tags: ['image', 'interior', 'render'],
    is_featured: true,
    featured_rank: 100,
  },

  // ── META (AWC 자체 랜딩 — 메타 사례) ─────────────────────────
  {
    filename: 'awc-landing-full.png',
    slug: 'awc-landing-full',
    title: 'AWC · 자체 랜딩 (v1)',
    subtitle: 'Agentic Workflows Club 랜딩 전체 스냅샷',
    kind: 'case_study',
    cover_aspect: '9:16',
    duration_minutes: 45,
    tags: ['awc', 'landing', 'case-study', 'meta'],
    is_featured: true,
    featured_rank: 5, // 최우선 노출
    author: 'AWC Team',
  },
];
