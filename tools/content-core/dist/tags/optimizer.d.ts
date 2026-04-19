/**
 * 태그의 점수를 계산합니다.
 * @param tag 태그
 * @param title 제목
 * @param content 내용
 * @returns 점수
 */
export declare function calculateTagScore(tag: string, title: string, content: string): number;
/**
 * TF-IDF 점수를 계산합니다.
 * @param word 단어
 * @param document 현재 문서
 * @param allDocuments 전체 문서 집합
 * @returns TF-IDF 점수
 */
export declare function calculateTFIDF(word: string, document: string, allDocuments: string[]): number;
/**
 * 태그 리스트를 최적화합니다.
 * @param tags 원본 태그 리스트
 * @param options 최적화 옵션
 * @returns 최적화된 태그 리스트
 */
export declare function optimizeTags(tags: string[], options?: {
    maxTags?: number;
    minLength?: number;
    maxLength?: number;
    removeDuplicates?: boolean;
    sortByRelevance?: boolean;
}): string[];
/**
 * 태그 그룹을 병합하고 최적화합니다.
 * @param tagGroups 여러 태그 그룹
 * @param weights 각 그룹의 가중치
 * @returns 병합된 태그 리스트
 */
export declare function mergeTagGroups(tagGroups: string[][], weights?: number[]): string[];
/**
 * 태그의 SEO 점수를 계산합니다.
 * @param tag 태그
 * @param context SEO 컨텍스트
 * @returns SEO 점수
 */
export declare function calculateSEOScore(tag: string, context?: {
    title?: string;
    metaDescription?: string;
    content?: string;
    competitorTags?: string[];
}): number;
/**
 * 태그 추천을 위한 관련 태그를 찾습니다.
 * @param baseTags 기본 태그들
 * @param tagPool 전체 태그 풀
 * @returns 추천 태그 리스트
 */
export declare function findRelatedTags(baseTags: string[], tagPool: string[]): string[];
/**
 * 태그 성과 분석을 위한 메트릭 계산
 * @param tags 태그 리스트
 * @param performance 성과 데이터
 * @returns 태그별 성과 메트릭
 */
export declare function analyzeTagPerformance(tags: string[], performance: {
    views?: number;
    clicks?: number;
    shares?: number;
    avgTimeOnPage?: number;
}): Record<string, {
    effectiveness: number;
    recommendation: string;
}>;
//# sourceMappingURL=optimizer.d.ts.map