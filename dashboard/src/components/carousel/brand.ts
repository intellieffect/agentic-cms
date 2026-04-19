// Tenant brand — multi-tenant 환경에서 env 로 주입.
//   NEXT_PUBLIC_BRAND_HANDLE  — 워터마크/소셜 핸들 (예: "@brxce.ai")
//   NEXT_PUBLIC_BRAND_EMOJI   — 로고 이모지 (예: "🦞")
// 값이 없으면 빈 문자열 — 슬라이드 상에 노출 안 됨.
const brandHandle = process.env.NEXT_PUBLIC_BRAND_HANDLE || ''
const brandEmoji = process.env.NEXT_PUBLIC_BRAND_EMOJI || ''

export const BRXCE_BRAND = {
  colors: {
    primary: '#FF6B35',
    background: '#0A0A0A',
    surface: '#1A1A1A',
    text: '#FAFAFA',
    textMuted: '#A0A0A0',
    accent: '#4ECDC4',
  },
  fonts: {
    headline: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
    body: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
    code: 'JetBrains Mono, monospace',
  },
  logo: { emoji: brandEmoji },
  watermark: brandHandle,
}
