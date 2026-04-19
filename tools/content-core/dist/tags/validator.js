// 태그 검증 관련 함수들
import { preserveCompounds, stopWords, unnecessarySuffixes, synonymMap } from './dictionary.js';
/**
 * 태그를 정규화합니다.
 * @param tag 원본 태그
 * @returns 정규화된 태그
 */
export function normalizeTag(tag) {
    let normalized = tag.trim();
    // 동의어 매핑
    if (synonymMap[normalized]) {
        normalized = synonymMap[normalized];
    }
    // 불필요한 접미사 제거 (한글만 해당)
    if (/[가-힣]/.test(normalized)) {
        for (const suffix of unnecessarySuffixes) {
            if (normalized.endsWith(suffix) && normalized.length > suffix.length + 2) {
                normalized = normalized.slice(0, -suffix.length);
                break;
            }
        }
    }
    // 연도 패턴 필터링 (2000년대)
    if (/^20\d{2}년?$/.test(normalized)) {
        return '';
    }
    // 최소 길이 체크
    if (normalized.length < 2) {
        return '';
    }
    return normalized;
}
/**
 * 복합어인지 확인합니다.
 * @param word 확인할 단어
 * @returns 복합어 여부
 */
export function isCompoundWord(word) {
    // preserveCompounds에 있는지 확인
    if (preserveCompounds.has(word)) {
        return true;
    }
    // 패턴 기반 복합어 확인
    // 1. 하이픈이나 점으로 연결된 경우
    if (/-|\./.test(word) && word.length > 3) {
        return true;
    }
    // 2. 언더스코어로 연결된 경우
    if (/_/.test(word) && word.length > 3) {
        return true;
    }
    // 3. CamelCase (대문자가 중간에 있는 경우)
    if (/[a-z][A-Z]/.test(word)) {
        return true;
    }
    // 4. 숫자와 문자가 혼합된 경우 (버전 정보 등)
    if (/[a-zA-Z]+\d+/.test(word) || /\d+[a-zA-Z]+/.test(word)) {
        return true;
    }
    // 5. 공백으로 구분된 복합어
    if (/\s/.test(word) && word.split(/\s+/).length > 1) {
        return true;
    }
    return false;
}
/**
 * 유효한 태그 단어인지 확인합니다.
 * @param word 확인할 단어
 * @returns 유효한 태그 여부
 */
export function isValidTagWord(word) {
    // 빈 문자열 체크
    if (!word || word.trim().length === 0) {
        return false;
    }
    const normalized = word.toLowerCase().trim();
    // 불용어 체크
    if (stopWords.has(normalized)) {
        return false;
    }
    // 너무 짧은 단어 필터링 (1글자)
    if (normalized.length < 2) {
        return false;
    }
    // 너무 긴 단어 필터링
    if (normalized.length > 30) {
        return false;
    }
    // 숫자만으로 이루어진 경우 필터링
    if (/^\d+$/.test(normalized)) {
        return false;
    }
    // 특수문자만으로 이루어진 경우 필터링
    if (/^[^a-zA-Z0-9가-힣]+$/.test(normalized)) {
        return false;
    }
    // 복합어는 유효하다고 판단
    if (isCompoundWord(word)) {
        return true;
    }
    // 영어 단어는 최소 2글자 이상
    if (/^[a-zA-Z]+$/.test(normalized) && normalized.length < 2) {
        return false;
    }
    // 한글 단어는 최소 2글자 이상
    if (/^[가-힣]+$/.test(normalized) && normalized.length < 2) {
        return false;
    }
    return true;
}
/**
 * 태그 리스트를 검증하고 정제합니다.
 * @param tags 원본 태그 리스트
 * @returns 검증된 태그 리스트
 */
export function validateTags(tags) {
    const validatedTags = [];
    const seen = new Set();
    for (const tag of tags) {
        const normalized = normalizeTag(tag);
        if (normalized && isValidTagWord(normalized) && !seen.has(normalized.toLowerCase())) {
            validatedTags.push(normalized);
            seen.add(normalized.toLowerCase());
        }
    }
    return validatedTags;
}
/**
 * 태그의 품질을 평가합니다.
 * @param tag 평가할 태그
 * @returns 품질 점수 (0-1)
 */
export function evaluateTagQuality(tag) {
    let score = 1.0;
    // 너무 짧은 태그
    if (tag.length < 3) {
        score *= 0.7;
    }
    // 너무 긴 태그
    if (tag.length > 20) {
        score *= 0.8;
    }
    // 복합어나 전문 용어는 가산점
    if (isCompoundWord(tag) || preserveCompounds.has(tag)) {
        score *= 1.2;
    }
    // 영어+숫자 조합 (버전 정보 등)은 가산점
    if (/[a-zA-Z]+\d+/.test(tag)) {
        score *= 1.1;
    }
    // 모두 대문자인 약어는 가산점
    if (/^[A-Z]{2,}$/.test(tag)) {
        score *= 1.1;
    }
    return Math.min(1.0, score);
}
/**
 * 두 태그가 유사한지 확인합니다.
 * @param tag1 첫 번째 태그
 * @param tag2 두 번째 태그
 * @returns 유사도 (0-1)
 */
export function calculateTagSimilarity(tag1, tag2) {
    const norm1 = tag1.toLowerCase();
    const norm2 = tag2.toLowerCase();
    // 완전 일치
    if (norm1 === norm2) {
        return 1.0;
    }
    // 한쪽이 다른 쪽을 포함
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
        return 0.8;
    }
    // 편집 거리 계산 (간단한 버전)
    const maxLen = Math.max(norm1.length, norm2.length);
    let distance = 0;
    for (let i = 0; i < maxLen; i++) {
        if (norm1[i] !== norm2[i]) {
            distance++;
        }
    }
    return 1 - (distance / maxLen);
}
//# sourceMappingURL=validator.js.map