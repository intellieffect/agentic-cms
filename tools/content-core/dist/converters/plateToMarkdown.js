// PlateJS를 마크다운으로 변환
export function convertPlateToMarkdown(nodes) {
    let markdown = '';
    function processNode(node, depth = 0) {
        let result = '';
        if (node.text !== undefined) {
            // 텍스트 노드
            let text = node.text;
            if (node.bold)
                text = `**${text}**`;
            if (node.italic)
                text = `*${text}*`;
            if (node.code)
                text = `\`${text}\``;
            if (node.underline)
                text = `__${text}__`;
            if (node.highlight)
                text = `==${text}==`;
            return text;
        }
        // 엘리먼트 노드
        switch (node.type) {
            case 'h1':
                result = `# ${processChildren(node.children)}\n\n`;
                break;
            case 'h2':
                result = `## ${processChildren(node.children)}\n\n`;
                break;
            case 'h3':
                result = `### ${processChildren(node.children)}\n\n`;
                break;
            case 'h4':
                result = `#### ${processChildren(node.children)}\n\n`;
                break;
            case 'h5':
                result = `##### ${processChildren(node.children)}\n\n`;
                break;
            case 'h6':
                result = `###### ${processChildren(node.children)}\n\n`;
                break;
            case 'p':
                const content = processChildren(node.children);
                if (content.trim()) {
                    result = `${content}\n\n`;
                }
                break;
            case 'blockquote':
                result = `> ${processChildren(node.children)}\n\n`;
                break;
            case 'ul':
                result = processListItems(node.children, false) + '\n';
                break;
            case 'ol':
                result = processListItems(node.children, true) + '\n';
                break;
            case 'li':
                // li는 processListItems에서 처리
                break;
            case 'code_block':
                const lang = node.lang || '';
                const codeLines = node.children
                    .map((line) => processChildren(line.children))
                    .join('\n');
                result = `\`\`\`${lang}\n${codeLines}\n\`\`\`\n\n`;
                break;
            case 'code_line':
                result = processChildren(node.children);
                break;
            case 'img':
                const alt = node.alt || 'image';
                const url = node.url || '';
                result = `![${alt}](${url})\n\n`;
                if (node.caption) {
                    result += `*${node.caption}*\n\n`;
                }
                break;
            case 'callout':
                const icon = getCalloutIcon(node.variant);
                const calloutContent = node.children
                    .map((child) => processNode(child))
                    .join('')
                    .trim();
                result = `${icon} ${calloutContent}\n\n`;
                break;
            case 'hr':
                result = '---\n\n';
                break;
            case 'table':
                result = processTable(node.children) + '\n';
                break;
            case 'tr':
            case 'th':
            case 'td':
                // 테이블 요소는 processTable에서 처리
                break;
            case 'column_group':
                // 컬럼 그룹은 마크다운에서 표현하기 어려우므로 섹션으로 변환
                result = node.children
                    .map((col) => processNode(col))
                    .join('\n---\n\n');
                break;
            case 'column':
                result = processChildren(node.children);
                break;
            default:
                result = processChildren(node.children);
        }
        return result;
    }
    function processChildren(children) {
        if (!children)
            return '';
        return children.map(child => processNode(child)).join('');
    }
    function processListItems(items, ordered) {
        return items.map((item, index) => {
            const prefix = ordered ? `${index + 1}. ` : '- ';
            const content = item.children
                ? processChildren(item.children)
                    .trim()
                    .replace(/\n\n$/, '') // 리스트 아이템 끝의 이중 줄바꿈 제거
                : '';
            return `${prefix}${content}`;
        }).join('\n');
    }
    function processTable(rows) {
        if (!rows || rows.length === 0)
            return '';
        let table = '';
        let isFirstRow = true;
        rows.forEach(row => {
            if (row.type === 'tr' && row.children) {
                const cells = row.children.map((cell) => {
                    const cellContent = processChildren(cell.children).trim();
                    return cellContent;
                });
                table += '| ' + cells.join(' | ') + ' |\n';
                // 헤더 행 뒤에 구분선 추가
                if (isFirstRow && row.children[0]?.type === 'th') {
                    table += '|' + cells.map(() => '---').join('|') + '|\n';
                    isFirstRow = false;
                }
            }
        });
        return table;
    }
    function getCalloutIcon(variant) {
        switch (variant) {
            case 'info':
                return 'ℹ️';
            case 'warning':
                return '⚠️';
            case 'error':
                return '❌';
            case 'success':
                return '✅';
            case 'note':
                return '📝';
            default:
                return '💡';
        }
    }
    nodes.forEach(node => {
        markdown += processNode(node);
    });
    return markdown.trim();
}
//# sourceMappingURL=plateToMarkdown.js.map