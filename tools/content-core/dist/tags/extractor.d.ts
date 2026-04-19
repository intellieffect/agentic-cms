/**
 * 텍스트에서 단어를 추출합니다.
 * @param text 분석할 텍스트
 * @returns 추출된 단어 목록
 */
export declare function extractWordsFromText(text: string): string[];
/**
 * 복합어를 추출합니다.
 * @param text 분석할 텍스트
 * @returns 추출된 복합어 목록
 */
export declare function extractCompoundWords(text: string): string[];
/**
 * 기술 용어를 추출합니다.
 * @param text 분석할 텍스트
 * @returns 추출된 기술 용어 목록
 */
export declare function extractTechTerms(text: string): string[];
/**
 * 카테고리별 핵심 태그를 가져옵니다.
 * @param category 카테고리명
 * @returns 핵심 태그 목록
 */
export declare function getCategoryKeyTags(category: string): string[];
/**
 * 스마트 태그를 추출합니다. (메인 함수)
 * @param title 게시글 제목
 * @param content 게시글 내용
 * @param category 카테고리
 * @param suggestedTags 추천 태그 (선택사항)
 * @returns 추출된 태그 목록
 */
export declare function extractSmartTags(title: string, content: string, category: string, suggestedTags?: string[]): Promise<string[]>;
/**
 * 다양한 태그를 선택합니다.
 * @param tags 후보 태그 목록
 * @param count 선택할 개수
 * @returns 선택된 태그 목록
 */
export declare function selectDiverseTags(tags: string[], count: number): string[];
/**
 * 태그 추출 설정
 */
export interface TagExtractionOptions {
    maxTags?: number;
    minScore?: number;
    includeCategoryTags?: boolean;
    diversityWeight?: number;
}
/**
 * 고급 태그 추출 함수
 * @param title 제목
 * @param content 내용
 * @param category 카테고리
 * @param options 추출 옵션
 * @returns 추출된 태그와 메타데이터
 */
export declare function extractTagsWithMetadata(title: string, content: string, category: string, options?: TagExtractionOptions): Promise<{
    tags: string[];
    metadata: {
        scores: Record<string, number>;
        sources: Record<string, string[]>;
        totalCandidates: number;
    };
}>;
//# sourceMappingURL=extractor.d.ts.map