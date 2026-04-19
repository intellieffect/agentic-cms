/**
 * 동의어 매핑
 * 여러 형태로 표현될 수 있는 단어들을 통일된 형태로 매핑
 */
export declare const synonymMap: Record<string, string>;
/**
 * 복합어로 보존해야 하는 단어 목록
 * 분리하면 의미가 달라지는 단어들
 */
export declare const preserveCompounds: Set<string>;
/**
 * 불필요한 접미사 목록
 * 태그에서 제거해야 할 접미사들
 */
export declare const unnecessarySuffixes: string[];
/**
 * 카테고리별 핵심 태그
 */
export declare const categoryKeyTags: Record<string, string[]>;
/**
 * 불용어 목록
 * 태그로 사용하기에 너무 일반적이거나 의미없는 단어들
 */
export declare const stopWords: Set<string>;
//# sourceMappingURL=dictionary.d.ts.map