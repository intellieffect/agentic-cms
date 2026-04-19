// PlateJS 관련 공통 유틸리티 함수들
// Re-export types for convenience
/**
 * 고유한 ID를 생성합니다.
 * @returns 타임스탬프와 랜덤 문자열을 조합한 고유 ID
 */
export function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * 텍스트 노드를 생성합니다.
 * @param text 텍스트 내용
 * @param props 추가 속성들
 * @returns 생성된 텍스트 노드
 */
export function createTextNode(text, props = {}) {
    return {
        id: generateId(),
        text,
        ...props
    };
}
/**
 * PlateNode에서 텍스트를 추출합니다.
 * @param node PlateNode
 * @returns 추출된 텍스트
 */
export function extractTextFromNode(node) {
    if (!node)
        return '';
    if (node.text) {
        return node.text;
    }
    if (node.children && Array.isArray(node.children)) {
        return node.children.map((child) => extractTextFromNode(child)).join('');
    }
    return '';
}
/**
 * 빈 단락 노드를 생성합니다.
 * @param children 자식 노드들
 * @returns 생성된 단락 노드
 */
export function createParagraphNode(children = []) {
    return {
        id: generateId(),
        type: 'p',
        children: children.length > 0 ? children : [createTextNode('')]
    };
}
/**
 * 제목 노드를 생성합니다.
 * @param level 제목 레벨 (1-6)
 * @param text 제목 텍스트
 * @returns 생성된 제목 노드
 */
export function createHeadingNode(level, text) {
    return {
        id: generateId(),
        type: `h${level}`,
        children: [createTextNode(text)]
    };
}
//# sourceMappingURL=plateUtils.js.map