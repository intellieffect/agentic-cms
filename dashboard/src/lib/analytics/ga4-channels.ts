// GA4 sessionDefaultChannelGroup 표준 enum (영어 고정).
// GA4 가 채널 enum 을 변경한 이력이 있어 (Cross-network 신설, Organic Shopping
// 분할 등), Google 이 향후 "Organic Search" 를 "Search (Organic)" 류로 리네임해도
// fuzzy 매칭으로 캐치하도록 유틸을 별도 파일로 분리.

export const GA4_CHANNEL_ORGANIC_SEARCH = "Organic Search";

// 채널 fuzzy 매칭 — Google 이 enum 이름을 살짝 바꿔도 검색 채널을 식별.
// "organic" + "search" 둘 다 포함이면 매칭. 다른 organic 채널 (Organic Social,
// Organic Shopping, Organic Video) 은 search 단어가 없어 false 로 떨어짐.
export function isOrganicSearchChannel(channelName: string | null | undefined): boolean {
  if (!channelName) return false;
  const lower = channelName.toLowerCase();
  return lower.includes("organic") && lower.includes("search");
}
