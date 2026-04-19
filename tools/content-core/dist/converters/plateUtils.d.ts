import { PlateNode, TextNode } from '../types/plate.js';
/**
 * 고유한 ID를 생성합니다.
 * @returns 타임스탬프와 랜덤 문자열을 조합한 고유 ID
 */
export declare function generateId(): string;
/**
 * 텍스트 노드를 생성합니다.
 * @param text 텍스트 내용
 * @param props 추가 속성들
 * @returns 생성된 텍스트 노드
 */
export declare function createTextNode(text: string, props?: any): TextNode;
/**
 * PlateNode에서 텍스트를 추출합니다.
 * @param node PlateNode
 * @returns 추출된 텍스트
 */
export declare function extractTextFromNode(node: any): string;
/**
 * 빈 단락 노드를 생성합니다.
 * @param children 자식 노드들
 * @returns 생성된 단락 노드
 */
export declare function createParagraphNode(children?: any[]): PlateNode;
/**
 * 제목 노드를 생성합니다.
 * @param level 제목 레벨 (1-6)
 * @param text 제목 텍스트
 * @returns 생성된 제목 노드
 */
export declare function createHeadingNode(level: number, text: string): PlateNode;
//# sourceMappingURL=plateUtils.d.ts.map