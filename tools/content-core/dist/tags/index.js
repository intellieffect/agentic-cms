// 태그 관련 모듈의 메인 export 파일
// 사전 데이터
export { synonymMap, preserveCompounds, unnecessarySuffixes, categoryKeyTags, stopWords } from './dictionary.js';
// 검증 함수
export { normalizeTag, isCompoundWord, isValidTagWord, validateTags, evaluateTagQuality, calculateTagSimilarity } from './validator.js';
// 추출 함수
export { extractWordsFromText, extractCompoundWords, extractTechTerms, getCategoryKeyTags, extractSmartTags, selectDiverseTags, extractTagsWithMetadata } from './extractor.js';
// 최적화 함수
export { calculateTagScore, calculateTFIDF, optimizeTags, mergeTagGroups, calculateSEOScore, findRelatedTags, analyzeTagPerformance } from './optimizer.js';
// 편의 함수 - 기존 tagExtractor.ts와의 호환성을 위해
export { extractSmartTags as default } from './extractor.js';
//# sourceMappingURL=index.js.map