/**
 * PlateJS 노드의 기본 인터페이스
 */
export interface PlateNode {
    id: string;
    type: string;
    children: (PlateNode | TextNode)[];
    [key: string]: any;
}
/**
 * PlateJS 텍스트 노드
 */
export interface TextNode {
    id: string;
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    highlight?: boolean;
    [key: string]: any;
}
/**
 * PlateJS 블록 요소 타입
 */
export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote' | 'ul' | 'ol' | 'li' | 'lic' | 'table' | 'tr' | 'td' | 'th' | 'callout' | 'code_block' | 'code_line' | 'img' | 'column_group' | 'column';
/**
 * PlateJS 콜아웃 변형
 */
export type CalloutVariant = 'info' | 'warning' | 'error' | 'success' | 'note';
/**
 * PlateJS 이미지 노드
 */
export interface PlateImageNode extends PlateNode {
    type: 'img';
    url: string;
    alt: string;
    caption?: Array<TextNode | {
        type: string;
        text: string;
        id: string;
    }>;
    width?: string | number;
    height?: string | number;
}
/**
 * PlateJS 콜아웃 노드
 */
export interface PlateCalloutNode extends PlateNode {
    type: 'callout';
    variant: CalloutVariant;
    children: PlateNode[];
}
/**
 * PlateJS 테이블 노드
 */
export interface PlateTableNode extends PlateNode {
    type: 'table';
    children: PlateTableRowNode[];
}
/**
 * PlateJS 테이블 행 노드
 */
export interface PlateTableRowNode extends PlateNode {
    type: 'tr';
    children: PlateTableCellNode[];
}
/**
 * PlateJS 테이블 셀 노드
 */
export interface PlateTableCellNode extends PlateNode {
    type: 'td' | 'th';
    children: PlateNode[];
}
/**
 * PlateJS 리스트 노드
 */
export interface PlateListNode extends PlateNode {
    type: 'ul' | 'ol';
    children: PlateListItemNode[];
}
/**
 * PlateJS 리스트 아이템 노드
 */
export interface PlateListItemNode extends PlateNode {
    type: 'li';
    children: PlateListItemContentNode[];
}
/**
 * PlateJS 리스트 아이템 콘텐츠 노드
 */
export interface PlateListItemContentNode extends PlateNode {
    type: 'lic';
    children: (TextNode | PlateNode)[];
}
/**
 * PlateJS 코드 블록 노드
 */
export interface PlateCodeBlockNode extends PlateNode {
    type: 'code_block';
    lang?: string;
    children: PlateCodeLineNode[];
}
/**
 * PlateJS 코드 라인 노드
 */
export interface PlateCodeLineNode extends PlateNode {
    type: 'code_line';
    children: TextNode[];
}
/**
 * PlateJS 컬럼 그룹 노드
 */
export interface PlateColumnGroupNode extends PlateNode {
    type: 'column_group';
    children: PlateColumnNode[];
}
/**
 * PlateJS 컬럼 노드
 */
export interface PlateColumnNode extends PlateNode {
    type: 'column';
    width?: string;
    children: PlateNode[];
}
/**
 * PlateJS 노드 타입 가드 함수들
 */
export declare const isTextNode: (node: any) => node is TextNode;
export declare const isPlateNode: (node: any) => node is PlateNode;
export declare const isImageNode: (node: PlateNode) => node is PlateImageNode;
export declare const isCalloutNode: (node: PlateNode) => node is PlateCalloutNode;
export declare const isTableNode: (node: PlateNode) => node is PlateTableNode;
export declare const isListNode: (node: PlateNode) => node is PlateListNode;
export declare const isHeadingNode: (node: PlateNode) => boolean;
export declare const getHeadingLevel: (node: PlateNode) => number | null;
//# sourceMappingURL=plate.d.ts.map