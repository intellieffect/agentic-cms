import {Node, Text} from 'slate';

// HTML 이스케이프 함수
const escapeHtml = (text: string): string => {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
};

// Slate 노드를 HTML로 변환
export const serializeToHtml = (nodes: Node[]): string => {
    return nodes.map(node => serializeNode(node)).join('');
};

const serializeNode = (node: Node): string => {
    if (Text.isText(node)) {
        let html = escapeHtml(node.text);

        // 텍스트 스타일 적용
        const textNode = node as any;
        if (textNode.bold) html = `<strong>${html}</strong>`;
        if (textNode.italic) html = `<em>${html}</em>`;
        if (textNode.underline) html = `<u>${html}</u>`;
        if (textNode.strikethrough) html = `<s>${html}</s>`;
        if (textNode.code) html = `<code>${html}</code>`;

        return html;
    }

    const children = node.children?.map((n: any) => serializeNode(n)).join('') || '';

    switch ((node as any).type) {
        case 'paragraph':
            return `<p>${children}</p>`;
        case 'h1':
            return `<h1>${children}</h1>`;
        case 'h2':
            return `<h2>${children}</h2>`;
        case 'h3':
            return `<h3>${children}</h3>`;
        case 'h4':
            return `<h4>${children}</h4>`;
        case 'h5':
            return `<h5>${children}</h5>`;
        case 'h6':
            return `<h6>${children}</h6>`;
        case 'blockquote':
            return `<blockquote>${children}</blockquote>`;
        case 'ul':
            return `<ul>${children}</ul>`;
        case 'ol':
            return `<ol>${children}</ol>`;
        case 'li':
            return `<li>${children}</li>`;
        case 'hr':
            return '<hr />';
        case 'code-block':
            const language = (node as any).language || 'plaintext';
            return `<pre><code class="language-${language}">${children}</code></pre>`;
        case 'image':
            const {url, alt} = node as any;
            return `<img src="${url}" alt="${alt || ''}" />`;
        case 'link':
            return `<a href="${(node as any).url}">${children}</a>`;
        case 'table':
            return `<table>${children}</table>`;
        case 'table-row':
            return `<tr>${children}</tr>`;
        case 'table-cell':
            return `<td>${children}</td>`;
        case 'table-header-cell':
            return `<th>${children}</th>`;
        case 'toggle':
            return `<details ${(node as any).isOpen ? 'open' : ''}><summary>${serializeNode((node as any).children[0])}</summary>${serializeNode((node as any).children[1])}</details>`;
        case 'toggle-content':
            return `<div>${children}</div>`;
        case 'callout':
            const calloutType = (node as any).calloutType || 'info';
            return `<div class="callout callout-${calloutType}">${children}</div>`;
        default:
            return children;
    }
};

// Slate 노드를 Markdown으로 변환
export const serializeToMarkdown = (nodes: Node[]): string => {
    return nodes.map(node => serializeNodeToMarkdown(node)).join('\n\n');
};

const serializeNodeToMarkdown = (node: Node, listDepth = 0): string => {
    if (Text.isText(node)) {
        let text = node.text;

        // 텍스트 스타일 적용
        const textNode = node as any;
        if (textNode.bold) text = `**${text}**`;
        if (textNode.italic) text = `*${text}*`;
        if (textNode.strikethrough) text = `~~${text}~~`;
        if (textNode.code) text = `\`${text}\``;

        return text;
    }

    const children = node.children?.map((n: any) => serializeNodeToMarkdown(n, listDepth)).join('') || '';

    switch ((node as any).type) {
        case 'paragraph':
            return children;
        case 'h1':
            return `# ${children}`;
        case 'h2':
            return `## ${children}`;
        case 'h3':
            return `### ${children}`;
        case 'h4':
            return `#### ${children}`;
        case 'h5':
            return `##### ${children}`;
        case 'h6':
            return `###### ${children}`;
        case 'blockquote':
            return children.split('\n').map(line => `> ${line}`).join('\n');
        case 'ul':
            return node.children?.map((child: any, index) =>
                serializeNodeToMarkdown(child, listDepth + 1)
            ).join('\n') || '';
        case 'ol':
            return node.children?.map((child: any, index) =>
                serializeNodeToMarkdown(child, listDepth + 1)
            ).join('\n') || '';
        case 'li':
            const bullet = listDepth > 0 ? '  '.repeat(listDepth - 1) + '- ' : '- ';
            return bullet + children;
        case 'hr':
            return '---';
        case 'code-block':
            const language = (node as any).language || '';
            return `\`\`\`${language}\n${children}\n\`\`\``;
        case 'image':
            const {url, alt} = node as any;
            return `![${alt || ''}](${url})`;
        case 'link':
            return `[${children}](${(node as any).url})`;
        case 'table':
            // 테이블은 간단한 형태로 변환
            return children;
        case 'toggle':
            return `<details>\n<summary>${serializeNodeToMarkdown((node as any).children[0])}</summary>\n\n${serializeNodeToMarkdown((node as any).children[1])}\n</details>`;
        case 'callout':
            const calloutType = (node as any).calloutType || 'info';
            return `> [!${calloutType}]\n> ${children.split('\n').join('\n> ')}`;
        default:
            return children;
    }
};

// Plain text로 변환
export const serializeToPlainText = (nodes: Node[]): string => {
    return nodes.map(node => serializeNodeToPlainText(node)).join('\n');
};

const serializeNodeToPlainText = (node: Node): string => {
    if (Text.isText(node)) {
        return node.text;
    }

    const children = node.children?.map((n: any) => serializeNodeToPlainText(n)).join('') || '';

    switch ((node as any).type) {
        case 'paragraph':
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
        case 'blockquote':
        case 'li':
            return children;
        case 'ul':
        case 'ol':
            return node.children?.map((child: any) => `• ${serializeNodeToPlainText(child)}`).join('\n') || '';
        case 'hr':
            return '---';
        case 'code-block':
            return children;
        case 'image':
            return `[이미지: ${(node as any).alt || ''}]`;
        case 'link':
            return children;
        case 'table':
            return children;
        case 'toggle':
            return `${serializeNodeToPlainText((node as any).children[0])}\n${serializeNodeToPlainText((node as any).children[1])}`;
        case 'callout':
            return children;
        default:
            return children;
    }
};
