import { generateId, createTextNode } from './plateUtils.js';
// Re-export types
// 패턴 정의
const PATTERNS = {
    // 콜아웃 패턴 (모든 가능한 이모지 조합 포함)
    callout: {
        info: /^(💡|ℹ️|ℹ|정보:|INFO:)/i,
        warning: /^(⚠️|⚠|⚡|주의:|WARNING:|❗)/i,
        error: /^(❌|🚫|❎|오류:|ERROR:|🔴)/i,
        success: /^(✅|✔️|✔|성공:|SUCCESS:|👍)/i,
        note: /^(📝|📌|📋|노트:|NOTE:|🗈️)/i,
    },
    // 컬럼 레이아웃 감지
    columns: {
        vs: /vs\.?|대\s?비|비교/i,
        list: /장점|단점|특징|기능/i,
    },
    // 테이블 감지
    table: {
        header: /^\|.*\|$/,
        separator: /^\|[\s-]+\|$/, // 마크다운 테이블 구분선 패턴
    },
    // 하이라이트 패턴 (더 많은 키워드 추가)
    highlight: {
        keywords: /\*\*(중요|주의|핵심|포인트|필수|강조|핵심 정리|요약|결론|팁|TIP|주목|참고|기억):\*\*/i,
        emphasis: /\*\*\*(.*?)\*\*\*/g, // 삼중 별표로 강한 강조
        marker: /==(.*?)==/g, // 형광펜 마커 스타일
        important: /(중요:|핵심:|필수:|주의:|TIP:|팁:|요약:|결론:)/i,
    },
};
// 복잡한 인라인 스타일 처리 (하이라이트 + 링크 강화)
function processComplexInlineStyles(text) {
    // 링크가 포함된 경우 링크 전처리 먼저
    if (text.includes('](')) {
        return processLinksAndText(text);
    }
    const nodes = [];
    // 1. 형광펜 마커 스타일 처리 ==텍스트==
    const markerRegex = /==(.*?)==/g;
    let lastIndex = 0;
    let match;
    while ((match = markerRegex.exec(text)) !== null) {
        // 마커 이전 텍스트
        if (match.index > lastIndex) {
            const beforeText = text.slice(lastIndex, match.index);
            nodes.push(...processBasicInlineStyles(beforeText));
        }
        // 하이라이트된 텍스트
        const highlightedText = match[1];
        const highlightedNodes = processBasicInlineStyles(highlightedText);
        highlightedNodes.forEach(node => {
            node.highlight = true;
        });
        nodes.push(...highlightedNodes);
        lastIndex = markerRegex.lastIndex;
    }
    // 나머지 텍스트 처리
    if (lastIndex < text.length) {
        const remainingText = text.slice(lastIndex);
        nodes.push(...processBasicInlineStyles(remainingText));
    }
    return nodes.length > 0 ? nodes : [createTextNode(text)];
}
// 기본 인라인 스타일 처리 (bold, italic, code 등)
function processBasicInlineStyles(text) {
    const nodes = [];
    // 삼중 별표 강조 처리
    if (text.includes('***')) {
        const parts = text.split(/\*\*\*(.*?)\*\*\*/g);
        parts.forEach((part, index) => {
            if (index % 2 === 0 && part) {
                nodes.push(...processStandardMarkdown(part));
            }
            else if (part) {
                // 삼중 별표는 bold + highlight
                const emphasisNodes = processStandardMarkdown(part);
                emphasisNodes.forEach(node => {
                    node.bold = true;
                    node.highlight = true;
                });
                nodes.push(...emphasisNodes);
            }
        });
        return nodes;
    }
    // 중요 키워드 감지 및 하이라이트
    if (PATTERNS.highlight.keywords.test(text) || PATTERNS.highlight.important.test(text)) {
        const processedNodes = processStandardMarkdown(text);
        processedNodes.forEach(node => {
            if (PATTERNS.highlight.important.test(node.text)) {
                node.highlight = true;
            }
        });
        return processedNodes;
    }
    return processStandardMarkdown(text);
}
// 마크다운 링크를 PlateJS 'a' 노드로 변환하는 전처리
// [text](url) 패턴을 찾아서 분리하고, 링크는 별도 PlateNode로 반환
function processLinksAndText(text) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const result = [];
    let lastIndex = 0;
    let match;
    while ((match = linkRegex.exec(text)) !== null) {
        // 링크 이전 텍스트
        if (match.index > lastIndex) {
            const before = text.slice(lastIndex, match.index);
            result.push(...processStandardMarkdownCore(before));
        }
        // 링크 노드 — PlateJS 'a' 타입
        const linkText = match[1];
        const linkUrl = match[2];
        result.push({
            id: generateId(),
            type: 'a',
            url: linkUrl,
            children: processStandardMarkdownCore(linkText),
        });
        lastIndex = linkRegex.lastIndex;
    }
    // 나머지 텍스트
    if (lastIndex < text.length) {
        result.push(...processStandardMarkdownCore(text.slice(lastIndex)));
    }
    return result.length > 0 ? result : [createTextNode(text)];
}
// 표준 마크다운 처리 (링크 제외한 bold/italic/code)
function processStandardMarkdownCore(text) {
    const nodes = [];
    let remaining = text;
    while (remaining.length > 0) {
        // Bold 처리 — 내부 텍스트를 재귀 파싱하여 중첩 마커(~~, *, `) 지원
        if (remaining.startsWith('**')) {
            const endIndex = remaining.indexOf('**', 2);
            if (endIndex > 2) {
                const boldText = remaining.substring(2, endIndex);
                const innerNodes = processStandardMarkdownCore(boldText);
                innerNodes.forEach(node => { node.bold = true; });
                nodes.push(...innerNodes);
                remaining = remaining.substring(endIndex + 2);
                continue;
            }
        }
        // Strikethrough 처리
        if (remaining.startsWith('~~')) {
            const endIndex = remaining.indexOf('~~', 2);
            if (endIndex > 2) {
                const strikeText = remaining.substring(2, endIndex);
                nodes.push(createTextNode(strikeText, { strikethrough: true }));
                remaining = remaining.substring(endIndex + 2);
                continue;
            }
        }
        // Italic 처리
        if (remaining.startsWith('*')) {
            const endIndex = remaining.indexOf('*', 1);
            if (endIndex > 1) {
                const italicText = remaining.substring(1, endIndex);
                nodes.push(createTextNode(italicText, { italic: true }));
                remaining = remaining.substring(endIndex + 1);
                continue;
            }
        }
        // Inline code 처리
        if (remaining.startsWith('`')) {
            const endIndex = remaining.indexOf('`', 1);
            if (endIndex > 1) {
                const codeText = remaining.substring(1, endIndex);
                nodes.push(createTextNode(codeText, { code: true }));
                remaining = remaining.substring(endIndex + 1);
                continue;
            }
        }
        // 일반 텍스트 처리
        const nextSpecialChar = Math.min(remaining.indexOf('**') > -1 ? remaining.indexOf('**') : Infinity, remaining.indexOf('~~') > -1 ? remaining.indexOf('~~') : Infinity, remaining.indexOf('*') > -1 ? remaining.indexOf('*') : Infinity, remaining.indexOf('`') > -1 ? remaining.indexOf('`') : Infinity);
        if (nextSpecialChar === Infinity) {
            nodes.push(createTextNode(remaining));
            break;
        }
        else if (nextSpecialChar > 0) {
            nodes.push(createTextNode(remaining.substring(0, nextSpecialChar)));
            remaining = remaining.substring(nextSpecialChar);
        }
        else {
            nodes.push(createTextNode(remaining[0]));
            remaining = remaining.substring(1);
        }
    }
    return nodes.length > 0 ? nodes : [createTextNode(text)];
}
// 호환성 래퍼
const processStandardMarkdown = processStandardMarkdownCore;
// 테이블 파싱
function parseTable(lines, startIndex) {
    if (!PATTERNS.table.header.test(lines[startIndex])) {
        return null;
    }
    const rows = [];
    let i = startIndex;
    let isHeader = true;
    while (i < lines.length && PATTERNS.table.header.test(lines[i])) {
        const line = lines[i];
        // 마크다운 테이블 구분선(|---|---|)은 건너뛰기만 하고 PlateJS에는 포함하지 않음
        if (PATTERNS.table.separator.test(line)) {
            isHeader = false; // 구분선 이후는 body로 처리
            i++;
            continue; // 구분선 자체는 PlateJS 노드로 만들지 않음
        }
        // 셀 파싱
        const cells = line.split('|')
            .slice(1, -1) // 첫번째와 마지막 빈 문자열 제거
            .map(cell => cell.trim());
        const rowNode = {
            id: generateId(),
            type: 'tr',
            children: cells.map(cellText => ({
                id: generateId(),
                type: isHeader ? 'th' : 'td',
                children: [{
                        id: generateId(),
                        type: 'p',
                        children: processComplexInlineStyles(cellText)
                    }]
            }))
        };
        rows.push(rowNode);
        i++;
    }
    if (rows.length === 0) {
        return null;
    }
    return {
        table: {
            id: generateId(),
            type: 'table',
            children: rows
        },
        endIndex: i - 1
    };
}
// 컬럼 레이아웃 감지 및 생성
function shouldUseColumns(content) {
    return PATTERNS.columns.vs.test(content) || PATTERNS.columns.list.test(content);
}
function createColumnLayout(content) {
    const lines = content.split('\n').filter(line => line.trim());
    // VS 비교 형태 감지
    if (PATTERNS.columns.vs.test(content)) {
        const vsIndex = lines.findIndex(line => PATTERNS.columns.vs.test(line));
        const beforeVs = lines.slice(0, vsIndex).join('\n');
        const afterVs = lines.slice(vsIndex + 1).join('\n');
        return {
            id: generateId(),
            type: 'column_group',
            children: [
                {
                    id: generateId(),
                    type: 'column',
                    width: '50%',
                    children: processContent(beforeVs)
                },
                {
                    id: generateId(),
                    type: 'column',
                    width: '50%',
                    children: processContent(afterVs)
                }
            ]
        };
    }
    // 장단점 리스트 형태
    return {
        id: generateId(),
        type: 'column_group',
        children: [{
                id: generateId(),
                type: 'column',
                width: '100%',
                children: processContent(content)
            }]
    };
}
// 콘텐츠 처리 (재귀적)
function processContent(content) {
    const lines = content.split('\n');
    const nodes = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        // 인라인 처리만 필요한 경우
        nodes.push({
            id: generateId(),
            type: 'p',
            children: processComplexInlineStyles(trimmed)
        });
    }
    return nodes;
}
// 고급 변환 함수 (메인 함수)
export async function convertToPlateFormat(content, context, imageResolver) {
    const lines = content.split('\n');
    const nodes = [];
    const images = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        // 테이블 감지 및 파싱
        const tableResult = parseTable(lines, i);
        if (tableResult) {
            nodes.push(tableResult.table);
            i = tableResult.endIndex;
            continue;
        }
        // 콜아웃 감지
        let calloutType = null;
        for (const [type, pattern] of Object.entries(PATTERNS.callout)) {
            if (pattern.test(trimmed)) {
                calloutType = type;
                break;
            }
        }
        if (calloutType) {
            const calloutText = trimmed.replace(PATTERNS.callout[calloutType], '').trim();
            nodes.push({
                id: generateId(),
                type: 'callout',
                variant: calloutType,
                children: [{
                        id: generateId(),
                        type: 'p',
                        children: processComplexInlineStyles(calloutText)
                    }]
            });
            continue;
        }
        // 코드 블록 처리
        if (trimmed.startsWith('```')) {
            const language = trimmed.slice(3).trim() || 'plaintext';
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            nodes.push({
                id: generateId(),
                type: 'code_block',
                lang: language,
                children: [{
                        id: generateId(),
                        type: 'code_line',
                        children: [{
                                id: generateId(),
                                text: codeLines.join('\n')
                            }]
                    }]
            });
            continue;
        }
        // 이미지 플레이스홀더 처리
        if (trimmed.startsWith('[IMAGE:') && trimmed.endsWith(']')) {
            const description = trimmed.slice(7, -1).trim();
            if (imageResolver) {
                const resolved = await imageResolver(description);
                if (resolved) {
                    const imageNode = {
                        id: generateId(),
                        type: 'img',
                        url: resolved.url,
                        alt: description,
                        children: [],
                        caption: resolved.credit ? [
                            {
                                id: generateId(),
                                type: 'text',
                                text: resolved.credit
                            }
                        ] : undefined
                    };
                    nodes.push(imageNode);
                    images.push({ description, url: resolved.url, credit: resolved.credit, position: nodes.length - 1 });
                }
            }
            // imageResolver가 없으면 이미지 노드 스킵
            continue;
        }
        // 리스트 처리
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
            const listType = /^\d+\.\s/.test(trimmed) ? 'ol' : 'ul';
            const listItems = [];
            while (i < lines.length) {
                const currentLine = lines[i].trim();
                if (!currentLine)
                    break;
                if (listType === 'ul' && !currentLine.startsWith('- ') && !currentLine.startsWith('* '))
                    break;
                if (listType === 'ol' && !/^\d+\.\s/.test(currentLine))
                    break;
                const itemText = currentLine.replace(/^[-*]\s|^\d+\.\s/, '');
                listItems.push({
                    id: generateId(),
                    type: 'li',
                    children: [{
                            id: generateId(),
                            type: 'lic',
                            children: processComplexInlineStyles(itemText)
                        }]
                });
                i++;
            }
            i--; // 마지막 증가 보정
            nodes.push({
                id: generateId(),
                type: listType,
                children: listItems
            });
            continue;
        }
        // 인용구 처리
        if (trimmed.startsWith('>')) {
            const quoteText = trimmed.replace(/^>\s*/, '');
            nodes.push({
                id: generateId(),
                type: 'blockquote',
                children: [{
                        id: generateId(),
                        type: 'p',
                        children: processComplexInlineStyles(quoteText)
                    }]
            });
            continue;
        }
        // 제목 처리
        if (trimmed.startsWith('#')) {
            const level = trimmed.match(/^#+/)?.[0].length || 1;
            const text = trimmed.replace(/^#+\s*/, '');
            nodes.push({
                id: generateId(),
                type: `h${level}`,
                children: processComplexInlineStyles(text)
            });
            continue;
        }
        // 일반 단락
        // 하이라이트 키워드로 시작하는 경우 전체 문장 하이라이트
        if (PATTERNS.highlight.important.test(trimmed)) {
            const highlightedNodes = processComplexInlineStyles(trimmed);
            highlightedNodes.forEach(node => {
                node.highlight = true;
            });
            nodes.push({
                id: generateId(),
                type: 'p',
                children: highlightedNodes
            });
        }
        else {
            nodes.push({
                id: generateId(),
                type: 'p',
                children: processComplexInlineStyles(trimmed)
            });
        }
    }
    return { content: nodes, images };
}
// 기본 변환 함수 (호환성을 위해 유지)
export async function convertToPlateFormatBasic(content, context, imageResolver) {
    return convertToPlateFormat(content, context, imageResolver);
}
// Advanced 함수명도 export (호환성 유지)
export const convertToPlateFormatAdvanced = convertToPlateFormat;
// 콘텐츠에서 이미지 설명 추출
export function extractImageDescriptions(content) {
    const imageRegex = /\[IMAGE:\s*([^\]]+)\]/g;
    const descriptions = [];
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
        descriptions.push(match[1].trim());
    }
    return descriptions;
}
//# sourceMappingURL=plateConverter.js.map