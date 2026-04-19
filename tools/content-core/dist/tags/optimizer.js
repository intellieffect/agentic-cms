// 태그 최적화 및 스코어링 관련 함수들
import { synonymMap } from './dictionary.js';
import { normalizeTag } from './validator.js';
/**
 * 태그의 점수를 계산합니다.
 * @param tag 태그
 * @param title 제목
 * @param content 내용
 * @returns 점수
 */
export function calculateTagScore(tag, title, content) {
    let score = 0;
    const normalizedTag = tag.toLowerCase();
    const normalizedTitle = title.toLowerCase();
    const normalizedContent = content.toLowerCase();
    // 제목에 포함된 경우 높은 점수
    if (normalizedTitle.includes(normalizedTag)) {
        score += 10;
    }
    // 내용에서의 빈도
    const contentMatches = (normalizedContent.match(new RegExp(normalizedTag, 'g')) || []).length;
    score += Math.min(contentMatches * 2, 10); // 최대 10점
    // 동의어 매칭
    for (const [key, value] of Object.entries(synonymMap)) {
        if ((value.toLowerCase() === normalizedTag && normalizedContent.includes(key.toLowerCase())) ||
            (key.toLowerCase() === normalizedTag && normalizedContent.includes(value.toLowerCase()))) {
            score += 1;
        }
    }
    return score;
}
/**
 * TF-IDF 점수를 계산합니다.
 * @param word 단어
 * @param document 현재 문서
 * @param allDocuments 전체 문서 집합
 * @returns TF-IDF 점수
 */
export function calculateTFIDF(word, document, allDocuments) {
    // Term Frequency (TF)
    const wordCount = (document.match(new RegExp(word, 'gi')) || []).length;
    const totalWords = document.split(/\s+/).length;
    const tf = wordCount / totalWords;
    // Inverse Document Frequency (IDF)
    const docsWithWord = allDocuments.filter(doc => new RegExp(word, 'gi').test(doc)).length;
    const idf = Math.log(allDocuments.length / (docsWithWord || 1));
    return tf * idf;
}
/**
 * 태그 리스트를 최적화합니다.
 * @param tags 원본 태그 리스트
 * @param options 최적화 옵션
 * @returns 최적화된 태그 리스트
 */
export function optimizeTags(tags, options = {}) {
    const { maxTags = 10, minLength = 2, maxLength = 30, removeDuplicates = true, sortByRelevance = false } = options;
    let optimized = [...tags];
    // 길이 필터링
    optimized = optimized.filter(tag => tag.length >= minLength && tag.length <= maxLength);
    // 중복 제거
    if (removeDuplicates) {
        const seen = new Set();
        optimized = optimized.filter(tag => {
            const normalized = normalizeTag(tag).toLowerCase();
            if (seen.has(normalized)) {
                return false;
            }
            seen.add(normalized);
            return true;
        });
    }
    // 관련성 정렬 (구현 필요시)
    if (sortByRelevance) {
        // 여기서는 단순히 길이와 대소문자 혼합을 기준으로 정렬
        optimized.sort((a, b) => {
            // 복합어나 기술 용어를 우선
            const aScore = (a.includes('-') || a.includes('.') || /[A-Z]/.test(a)) ? 1 : 0;
            const bScore = (b.includes('-') || b.includes('.') || /[A-Z]/.test(b)) ? 1 : 0;
            return bScore - aScore;
        });
    }
    // 최대 개수 제한
    return optimized.slice(0, maxTags);
}
/**
 * 태그 그룹을 병합하고 최적화합니다.
 * @param tagGroups 여러 태그 그룹
 * @param weights 각 그룹의 가중치
 * @returns 병합된 태그 리스트
 */
export function mergeTagGroups(tagGroups, weights) {
    const tagScores = new Map();
    const defaultWeight = 1.0;
    tagGroups.forEach((group, index) => {
        const weight = weights?.[index] ?? defaultWeight;
        group.forEach((tag, position) => {
            const normalized = normalizeTag(tag).toLowerCase();
            const positionScore = 1 / (position + 1); // 위치 기반 점수
            const score = weight * positionScore;
            if (!tagScores.has(normalized) || tagScores.get(normalized) < score) {
                tagScores.set(normalized, score);
            }
        });
    });
    // 점수 기준 정렬
    return Array.from(tagScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => {
        // 원본 태그 찾기 (케이스 보존)
        for (const group of tagGroups) {
            for (const originalTag of group) {
                if (normalizeTag(originalTag).toLowerCase() === tag) {
                    return originalTag;
                }
            }
        }
        return tag;
    });
}
/**
 * 태그의 SEO 점수를 계산합니다.
 * @param tag 태그
 * @param context SEO 컨텍스트
 * @returns SEO 점수
 */
export function calculateSEOScore(tag, context = {}) {
    let score = 0;
    const normalizedTag = tag.toLowerCase();
    // 제목에 포함
    if (context.title && context.title.toLowerCase().includes(normalizedTag)) {
        score += 30;
    }
    // 메타 설명에 포함
    if (context.metaDescription && context.metaDescription.toLowerCase().includes(normalizedTag)) {
        score += 20;
    }
    // 내용에서의 키워드 포함 여부
    if (context.content) {
        const normalizedContent = context.content.toLowerCase();
        const keywordCount = (normalizedContent.match(new RegExp(normalizedTag, 'g')) || []).length;
        if (keywordCount >= 3 && keywordCount <= 10) {
            score += 25; // 적절한 키워드 포함 횟수
        }
        else if (keywordCount > 10) {
            score += 10; // 너무 많음
        }
        else if (keywordCount > 0) {
            score += 15; // 포함됨
        }
    }
    // 경쟁 태그와의 차별성
    if (context.competitorTags) {
        const isUnique = !context.competitorTags.some(ct => ct.toLowerCase() === normalizedTag);
        if (isUnique) {
            score += 15;
        }
    }
    // 태그 길이 (SEO 관점)
    if (tag.length >= 3 && tag.length <= 15) {
        score += 10; // 이상적인 길이
    }
    return Math.min(score, 100);
}
/**
 * 태그 추천을 위한 관련 태그를 찾습니다.
 * @param baseTags 기본 태그들
 * @param tagPool 전체 태그 풀
 * @returns 추천 태그 리스트
 */
export function findRelatedTags(baseTags, tagPool) {
    const related = [];
    const baseTagsNormalized = baseTags.map(t => normalizeTag(t).toLowerCase());
    tagPool.forEach(poolTag => {
        const normalizedPoolTag = normalizeTag(poolTag).toLowerCase();
        // 이미 있는 태그는 제외
        if (baseTagsNormalized.includes(normalizedPoolTag)) {
            return;
        }
        let relationScore = 0;
        // 부분 문자열 매칭
        baseTagsNormalized.forEach(baseTag => {
            if (normalizedPoolTag.includes(baseTag) || baseTag.includes(normalizedPoolTag)) {
                relationScore += 0.5;
            }
        });
        // 동의어 관계 확인
        for (const [key, value] of Object.entries(synonymMap)) {
            const normalizedKey = key.toLowerCase();
            const normalizedValue = value.toLowerCase();
            if (baseTagsNormalized.includes(normalizedKey) && normalizedPoolTag === normalizedValue) {
                relationScore += 1;
            }
            else if (baseTagsNormalized.includes(normalizedValue) && normalizedPoolTag === normalizedKey) {
                relationScore += 1;
            }
        }
        if (relationScore > 0) {
            related.push({ tag: poolTag, score: relationScore });
        }
    });
    // 점수 기준 정렬 및 상위 태그 반환
    return related
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(item => item.tag);
}
/**
 * 태그 성과 분석을 위한 메트릭 계산
 * @param tags 태그 리스트
 * @param performance 성과 데이터
 * @returns 태그별 성과 메트릭
 */
export function analyzeTagPerformance(tags, performance) {
    const baseScore = (performance.views || 0) * 0.1 +
        (performance.clicks || 0) * 0.3 +
        (performance.shares || 0) * 0.4 +
        (performance.avgTimeOnPage || 0) * 0.2;
    const avgScorePerTag = baseScore / tags.length;
    const result = {};
    tags.forEach(tag => {
        // 간단한 휴리스틱 기반 평가
        let effectiveness = avgScorePerTag;
        let recommendation = '유지';
        // 태그 특성에 따른 조정
        if (tag.length > 20) {
            effectiveness *= 0.8;
            recommendation = '단축 필요';
        }
        else if (tag.length < 3) {
            effectiveness *= 0.9;
            recommendation = '확장 고려';
        }
        // 기술 용어는 보너스
        if (/^[A-Z]{2,}$/.test(tag) || /\d/.test(tag)) {
            effectiveness *= 1.1;
        }
        result[tag] = {
            effectiveness: Math.min(effectiveness, 100),
            recommendation
        };
    });
    return result;
}
//# sourceMappingURL=optimizer.js.map