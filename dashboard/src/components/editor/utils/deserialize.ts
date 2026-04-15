import {jsx} from 'slate-hyperscript';
import {Descendant} from 'slate';

// HTML 문자열을 Slate 노드로 변환
export const deserializeFromHtml = (html: string): Descendant[] => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return deserialize(document.body);
};

const deserialize = (el: HTMLElement | ChildNode, markAttributes: any = {}): any => {
    if (el.nodeType === Node.TEXT_NODE) {
        return jsx('text', markAttributes, el.textContent);
    } else if (el.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const nodeAttributes: any = {...markAttributes};

    // 텍스트 스타일 처리
    switch (el.nodeName) {
        case 'STRONG':
        case 'B':
            nodeAttributes.bold = true;
            break;
        case 'EM':
        case 'I':
            nodeAttributes.italic = true;
            break;
        case 'U':
            nodeAttributes.underline = true;
            break;
        case 'S':
        case 'DEL':
            nodeAttributes.strikethrough = true;
            break;
        case 'CODE':
            nodeAttributes.code = true;
            break;
    }

    const children = Array.from(el.childNodes)
        .map(node => deserialize(node, nodeAttributes))
        .flat()
        .filter(Boolean);

    if (children.length === 0) {
        children.push(jsx('text', nodeAttributes, ''));
    }

    // 블록 요소 처리
    switch (el.nodeName) {
        case 'BODY':
            return jsx('fragment', {}, children);
        case 'BR':
            return jsx('text', {}, '\n');
        case 'P':
            return jsx('element', {type: 'paragraph'}, children);
        case 'H1':
            return jsx('element', {type: 'h1'}, children);
        case 'H2':
            return jsx('element', {type: 'h2'}, children);
        case 'H3':
            return jsx('element', {type: 'h3'}, children);
        case 'H4':
            return jsx('element', {type: 'h4'}, children);
        case 'H5':
            return jsx('element', {type: 'h5'}, children);
        case 'H6':
            return jsx('element', {type: 'h6'}, children);
        case 'BLOCKQUOTE':
            return jsx('element', {type: 'blockquote'}, children);
        case 'UL':
            return jsx('element', {type: 'ul'}, children);
        case 'OL':
            return jsx('element', {type: 'ol'}, children);
        case 'LI':
            return jsx('element', {type: 'li'}, children);
        case 'HR':
            return jsx('element', {type: 'hr'}, [{text: ''}]);
        case 'PRE':
            const preElement = el as HTMLElement;
            const codeElement = preElement.querySelector('code');
            const language = codeElement?.className.match(/language-(\w+)/)?.[1] || 'plaintext';
            return jsx('element', {type: 'code-block', language}, [
                {text: codeElement?.textContent || ''}
            ]);
        case 'IMG':
            const img = el as HTMLImageElement;
            return jsx('element', {
                type: 'image',
                url: img.src,
                alt: img.alt
            }, [{text: ''}]);
        case 'A':
            const link = el as HTMLAnchorElement;
            return jsx('element', {
                type: 'link',
                url: link.href
            }, children);
        case 'TABLE':
            return jsx('element', {type: 'table'}, children);
        case 'TR':
            return jsx('element', {type: 'table-row'}, children);
        case 'TD':
            return jsx('element', {type: 'table-cell'}, children);
        case 'TH':
            return jsx('element', {type: 'table-header-cell'}, children);
        case 'DETAILS':
            const details = el as HTMLDetailsElement;
            const summary = details.querySelector('summary');
            const content = Array.from(details.childNodes)
                .filter(node => node.nodeName !== 'SUMMARY')
                .map(node => deserialize(node, {}))
                .flat()
                .filter(Boolean);

            return jsx('element', {
                type: 'toggle',
                isOpen: details.open
            }, [
                jsx('element', {type: 'paragraph'}, summary ? deserialize(summary, {}) : [{text: 'Toggle'}]),
                jsx('element', {type: 'toggle-content'}, content.length > 0 ? content : [
                    jsx('element', {type: 'paragraph'}, [{text: ''}])
                ])
            ]);
        case 'DIV':
            const div = el as HTMLDivElement;
            if (div.classList.contains('callout')) {
                const calloutType = Array.from(div.classList)
                    .find(cls => cls.startsWith('callout-'))
                    ?.replace('callout-', '') || 'info';
                return jsx('element', {type: 'callout', calloutType}, children);
            }
            return children;
        default:
            return children;
    }
};

// JSON 형식의 데이터를 Slate 노드로 변환
export const deserializeFromJson = (json: string): Descendant[] => {
    try {
        const data = JSON.parse(json);
        return Array.isArray(data) ? data : [data];
    } catch (error) {
        console.error('Failed to parse JSON:', error);
        return [{type: 'paragraph', children: [{text: ''}]} as any];
    }
};

// Markdown을 Slate 노드로 변환 (기본 구현)
export const deserializeFromMarkdown = (markdown: string): Descendant[] => {
    const lines = markdown.split('\n');
    const nodes: Descendant[] = [];
    let currentNode: any = null;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = 'plaintext';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 코드 블록 처리
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLanguage = line.slice(3).trim() || 'plaintext';
                codeBlockContent = [];
            } else {
                inCodeBlock = false;
                nodes.push({
                    type: 'code-block',
                    language: codeBlockLanguage,
                    children: [{text: codeBlockContent.join('\n')}]
                } as any);
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            continue;
        }

        // 제목 처리
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            nodes.push({
                type: `h${level}`,
                children: [{text: headingMatch[2]}]
            } as any);
            continue;
        }

        // 리스트 처리
        const listMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
        if (listMatch) {
            nodes.push({
                type: 'li',
                children: [{text: listMatch[2]}]
            } as any);
            continue;
        }

        // 인용구 처리
        const quoteMatch = line.match(/^>\s*(.*)$/);
        if (quoteMatch) {
            nodes.push({
                type: 'blockquote',
                children: [{text: quoteMatch[1]}]
            } as any);
            continue;
        }

        // 구분선 처리
        if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
            nodes.push({
                type: 'hr',
                children: [{text: ''}]
            } as any);
            continue;
        }

        // 빈 줄은 건너뛰기
        if (line.trim() === '') {
            continue;
        }

        // 일반 단락
        nodes.push({
            type: 'paragraph',
            children: parseInlineMarkdown(line)
        } as any);
    }

    return nodes.length > 0 ? nodes : [{type: 'paragraph', children: [{text: ''}]} as any];
};

// 인라인 마크다운 파싱
const parseInlineMarkdown = (text: string): any[] => {
    const children: any[] = [];
    let remainingText = text;

    // 간단한 구현 - 실제로는 더 복잡한 파싱이 필요
    const patterns = [
        {regex: /\*\*([^*]+)\*\*/, mark: 'bold'},
        {regex: /\*([^*]+)\*/, mark: 'italic'},
        {regex: /_([^_]+)_/, mark: 'italic'},
        {regex: /~~([^~]+)~~/, mark: 'strikethrough'},
        {regex: /`([^`]+)`/, mark: 'code'}
    ];

    while (remainingText) {
        let matched = false;

        for (const pattern of patterns) {
            const match = remainingText.match(pattern.regex);
            if (match && match.index !== undefined) {
                // 매치 전 텍스트
                if (match.index > 0) {
                    children.push({text: remainingText.slice(0, match.index)});
                }

                // 매치된 텍스트
                children.push({text: match[1], [pattern.mark]: true});

                // 나머지 텍스트
                remainingText = remainingText.slice(match.index + match[0].length);
                matched = true;
                break;
            }
        }

        if (!matched) {
            children.push({text: remainingText});
            break;
        }
    }

    return children.length > 0 ? children : [{text: ''}];
};
