// PlateJS 관련 타입 정의
/**
 * PlateJS 노드 타입 가드 함수들
 */
export const isTextNode = (node) => {
    return node && typeof node.text === 'string';
};
export const isPlateNode = (node) => {
    return node && typeof node.type === 'string' && Array.isArray(node.children);
};
export const isImageNode = (node) => {
    return node.type === 'img';
};
export const isCalloutNode = (node) => {
    return node.type === 'callout';
};
export const isTableNode = (node) => {
    return node.type === 'table';
};
export const isListNode = (node) => {
    return node.type === 'ul' || node.type === 'ol';
};
export const isHeadingNode = (node) => {
    return /^h[1-6]$/.test(node.type);
};
export const getHeadingLevel = (node) => {
    const match = node.type.match(/^h([1-6])$/);
    return match ? parseInt(match[1], 10) : null;
};
//# sourceMappingURL=plate.js.map