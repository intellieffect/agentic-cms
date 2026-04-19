/**
 * 태그를 정규화합니다.
 * @param tag 원본 태그
 * @returns 정규화된 태그
 */
export declare function normalizeTag(tag: string): string;
/**
 * 복합어인지 확인합니다.
 * @param word 확인할 단어
 * @returns 복합어 여부
 */
export declare function isCompoundWord(word: string): boolean;
/**
 * 유효한 태그 단어인지 확인합니다.
 * @param word 확인할 단어
 * @returns 유효한 태그 여부
 */
export declare function isValidTagWord(word: string): boolean;
/**
 * 태그 리스트를 검증하고 정제합니다.
 * @param tags 원본 태그 리스트
 * @returns 검증된 태그 리스트
 */
export declare function validateTags(tags: string[]): string[];
/**
 * 태그의 품질을 평가합니다.
 * @param tag 평가할 태그
 * @returns 품질 점수 (0-1)
 */
export declare function evaluateTagQuality(tag: string): number;
/**
 * 두 태그가 유사한지 확인합니다.
 * @param tag1 첫 번째 태그
 * @param tag2 두 번째 태그
 * @returns 유사도 (0-1)
 */
export declare function calculateTagSimilarity(tag1: string, tag2: string): number;
//# sourceMappingURL=validator.d.ts.map