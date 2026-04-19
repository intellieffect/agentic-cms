// 태그 추출 관련 핵심 함수들
import { isValidTagWord, normalizeTag, isCompoundWord } from './validator.js';
import { categoryKeyTags, preserveCompounds } from './dictionary.js';
import { calculateTagScore } from './optimizer.js';
/**
 * 텍스트에서 단어를 추출합니다.
 * @param text 분석할 텍스트
 * @returns 추출된 단어 목록
 */
export function extractWordsFromText(text) {
    // 기본 단어 분리 (공백, 구두점 기준)
    const words = text.split(/[\s\p{P}]+/u).filter(word => word.length > 0);
    // 추가로 camelCase 분리
    const expandedWords = [];
    words.forEach(word => {
        // camelCase 분리
        const camelCaseWords = word.split(/(?=[A-Z])/);
        if (camelCaseWords.length > 1) {
            expandedWords.push(word); // 원본도 유지
            expandedWords.push(...camelCaseWords.filter(w => w.length > 0));
        }
        else {
            expandedWords.push(word);
        }
    });
    return [...new Set(expandedWords)];
}
/**
 * 복합어를 추출합니다.
 * @param text 분석할 텍스트
 * @returns 추출된 복합어 목록
 */
export function extractCompoundWords(text) {
    const compounds = [];
    // 1. 하이픈으로 연결된 단어 (예: React-Native, e-commerce)
    const hyphenated = text.match(/\b[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)+\b/g) || [];
    compounds.push(...hyphenated);
    // 2. 점으로 연결된 단어 (예: Node.js, ASP.NET)
    const dotted = text.match(/\b[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/g) || [];
    compounds.push(...dotted);
    // 3. 언더스코어로 연결된 단어 (예: user_id, MAX_VALUE)
    const underscored = text.match(/\b[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)+\b/g) || [];
    compounds.push(...underscored);
    // 4. CamelCase (예: JavaScript, TypeScript)
    const camelCase = text.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) || [];
    compounds.push(...camelCase);
    // 5. 숫자가 포함된 복합어 (예: ES6, HTML5)
    const withNumbers = text.match(/\b[a-zA-Z]+\d+\b|\b\d+[a-zA-Z]+\b/g) || [];
    compounds.push(...withNumbers);
    return [...new Set(compounds)];
}
/**
 * 기술 용어를 추출합니다.
 * @param text 분석할 텍스트
 * @returns 추출된 기술 용어 목록
 */
export function extractTechTerms(text) {
    const techTerms = [];
    // 1. 대문자 약어 (예: API, REST, SQL)
    const acronyms = text.match(/\b[A-Z]{2,}\b/g) || [];
    techTerms.push(...acronyms);
    // 2. 버전 정보가 포함된 용어 (예: React 18, Vue 3)
    const versioned = text.match(/\b[a-zA-Z]+\s+\d+(?:\.\d+)*\b/g) || [];
    techTerms.push(...versioned);
    // 3. 슬래시로 구분된 용어 (예: CI/CD, UI/UX)
    const slashed = text.match(/\b[A-Z]+\/[A-Z]+\b/g) || [];
    techTerms.push(...slashed);
    // 4. preserveCompounds에서 매칭되는 용어 찾기
    preserveCompounds.forEach(compound => {
        const regex = new RegExp(`\\b${compound}\\b`, 'gi');
        const matches = text.match(regex) || [];
        techTerms.push(...matches);
    });
    return [...new Set(techTerms)];
}
/**
 * 카테고리별 핵심 태그를 가져옵니다.
 * @param category 카테고리명
 * @returns 핵심 태그 목록
 */
export function getCategoryKeyTags(category) {
    const normalizedCategory = category.toLowerCase();
    return categoryKeyTags[normalizedCategory] || categoryKeyTags['general'] || [];
}
/**
 * 스마트 태그를 추출합니다. (메인 함수)
 * @param title 게시글 제목
 * @param content 게시글 내용
 * @param category 카테고리
 * @param suggestedTags 추천 태그 (선택사항)
 * @returns 추출된 태그 목록
 */
export async function extractSmartTags(title, content, category, suggestedTags) {
    const extractedTags = [];
    const fullText = `${title} ${content}`;
    // 1. 기본 단어 추출
    const words = extractWordsFromText(fullText);
    words.forEach(word => {
        const normalized = normalizeTag(word);
        if (normalized && isValidTagWord(normalized)) {
            const score = calculateTagScore(normalized, title, content);
            extractedTags.push({ tag: normalized, score });
        }
    });
    // 2. 복합어 추출
    const compounds = extractCompoundWords(fullText);
    compounds.forEach(compound => {
        const normalized = normalizeTag(compound);
        if (normalized && isValidTagWord(normalized)) {
            const score = calculateTagScore(normalized, title, content) * 1.5; // 복합어 가중치
            extractedTags.push({ tag: normalized, score });
        }
    });
    // 3. 기술 용어 추출
    const techTerms = extractTechTerms(fullText);
    techTerms.forEach(term => {
        const normalized = normalizeTag(term);
        if (normalized && isValidTagWord(normalized)) {
            const score = calculateTagScore(normalized, title, content) * 2; // 기술 용어 가중치
            extractedTags.push({ tag: normalized, score });
        }
    });
    // 4. 카테고리 핵심 태그 추가
    const categoryTags = getCategoryKeyTags(category);
    categoryTags.forEach(tag => {
        const score = calculateTagScore(tag, title, content) * 1.2; // 카테고리 태그 가중치
        extractedTags.push({ tag, score });
    });
    // 5. 추천 태그 처리
    if (suggestedTags && suggestedTags.length > 0) {
        suggestedTags.forEach(tag => {
            const normalized = normalizeTag(tag);
            if (normalized && isValidTagWord(normalized)) {
                extractedTags.push({ tag: normalized, score: 100 }); // 추천 태그 최고 점수
            }
        });
    }
    // 6. 중복 제거 및 정렬
    const tagMap = new Map();
    extractedTags.forEach(({ tag, score }) => {
        const key = tag.toLowerCase();
        if (!tagMap.has(key) || tagMap.get(key) < score) {
            tagMap.set(key, score);
        }
    });
    // 7. 점수 기준 정렬 및 상위 태그 선택
    const sortedTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tag]) => {
        // 원본 케이스 복원
        const original = extractedTags.find(t => t.tag.toLowerCase() === tag);
        return original ? original.tag : tag;
    });
    // 8. 다양성을 고려한 최종 선택
    return selectDiverseTags(sortedTags, 10);
}
/**
 * 다양한 태그를 선택합니다.
 * @param tags 후보 태그 목록
 * @param count 선택할 개수
 * @returns 선택된 태그 목록
 */
export function selectDiverseTags(tags, count) {
    if (tags.length <= count) {
        return tags;
    }
    const selected = [];
    const categories = {
        english: [],
        korean: [],
        compound: [],
        acronym: [],
        versioned: []
    };
    // 태그 분류
    tags.forEach(tag => {
        if (/^[A-Z]{2,}$/.test(tag)) {
            categories.acronym.push(tag);
        }
        else if (/\d/.test(tag)) {
            categories.versioned.push(tag);
        }
        else if (isCompoundWord(tag)) {
            categories.compound.push(tag);
        }
        else if (/^[a-zA-Z]+$/.test(tag)) {
            categories.english.push(tag);
        }
        else if (/[가-힣]/.test(tag)) {
            categories.korean.push(tag);
        }
        else {
            categories.compound.push(tag); // 기타는 compound로 분류
        }
    });
    // 각 카테고리에서 균형있게 선택
    const categoryKeys = Object.keys(categories);
    let index = 0;
    while (selected.length < count) {
        let addedInRound = false;
        for (const key of categoryKeys) {
            if (categories[key].length > index && selected.length < count) {
                selected.push(categories[key][index]);
                addedInRound = true;
            }
        }
        if (!addedInRound) {
            // 더 이상 추가할 태그가 없으면 종료
            break;
        }
        index++;
    }
    // 선택된 태그가 부족하면 나머지 추가
    if (selected.length < count) {
        const remaining = tags.filter(tag => !selected.includes(tag));
        selected.push(...remaining.slice(0, count - selected.length));
    }
    return selected.slice(0, count);
}
/**
 * 고급 태그 추출 함수
 * @param title 제목
 * @param content 내용
 * @param category 카테고리
 * @param options 추출 옵션
 * @returns 추출된 태그와 메타데이터
 */
export async function extractTagsWithMetadata(title, content, category, options = {}) {
    const { maxTags = 10, minScore = 0.1, includeCategoryTags = true, diversityWeight = 0.5 } = options;
    const candidates = [];
    const fullText = `${title} ${content}`;
    // 태그 추출 및 소스 추적
    const words = extractWordsFromText(fullText);
    words.forEach(word => {
        const normalized = normalizeTag(word);
        if (normalized && isValidTagWord(normalized)) {
            const score = calculateTagScore(normalized, title, content);
            if (score >= minScore) {
                candidates.push({ tag: normalized, score, source: 'words' });
            }
        }
    });
    // 복합어 추출
    const compounds = extractCompoundWords(fullText);
    compounds.forEach(compound => {
        const normalized = normalizeTag(compound);
        if (normalized && isValidTagWord(normalized)) {
            const score = calculateTagScore(normalized, title, content) * 1.5;
            if (score >= minScore) {
                candidates.push({ tag: normalized, score, source: 'compounds' });
            }
        }
    });
    // 기술 용어 추출
    const techTerms = extractTechTerms(fullText);
    techTerms.forEach(term => {
        const normalized = normalizeTag(term);
        if (normalized && isValidTagWord(normalized)) {
            const score = calculateTagScore(normalized, title, content) * 2;
            if (score >= minScore) {
                candidates.push({ tag: normalized, score, source: 'techTerms' });
            }
        }
    });
    // 카테고리 태그
    if (includeCategoryTags) {
        const categoryTags = getCategoryKeyTags(category);
        categoryTags.forEach(tag => {
            const score = calculateTagScore(tag, title, content) * 1.2;
            if (score >= minScore) {
                candidates.push({ tag, score, source: 'category' });
            }
        });
    }
    // 중복 제거 및 최고 점수 유지
    const tagMap = new Map();
    candidates.forEach(({ tag, score, source }) => {
        const key = tag.toLowerCase();
        if (!tagMap.has(key)) {
            tagMap.set(key, { score: 0, sources: new Set() });
        }
        const data = tagMap.get(key);
        data.score = Math.max(data.score, score);
        data.sources.add(source);
    });
    // 정렬 및 선택
    const sortedTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, maxTags * 2); // 다양성 선택을 위해 더 많이 가져옴
    // 다양성을 고려한 최종 선택
    const finalTags = selectDiverseTags(sortedTags.map(([tag]) => {
        // 원본 케이스 복원
        const original = candidates.find(c => c.tag.toLowerCase() === tag);
        return original ? original.tag : tag;
    }), maxTags);
    // 메타데이터 구성
    const scores = {};
    const sources = {};
    finalTags.forEach(tag => {
        const key = tag.toLowerCase();
        const data = tagMap.get(key);
        if (data) {
            scores[tag] = data.score;
            sources[tag] = Array.from(data.sources);
        }
    });
    return {
        tags: finalTags,
        metadata: {
            scores,
            sources,
            totalCandidates: candidates.length
        }
    };
}
//# sourceMappingURL=extractor.js.map