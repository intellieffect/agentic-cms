import { resolveImageUrl } from "./resolveImageUrl.js";
// --- Callout variant map (matches BlogContent.tsx) ---
const calloutVariants = {
    info: { icon: "💡", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
    warning: { icon: "⚠️", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.3)" },
    error: { icon: "🚫", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
    success: { icon: "✅", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" },
    note: { icon: "📝", bg: "#111", border: "#333" },
};
// --- Helpers ---
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function decodeHtmlEntities(text) {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, "/")
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
function getCodeContent(node) {
    if (node.value)
        return node.value;
    if (!node.children)
        return "";
    return node.children
        .map((line) => {
        if (typeof line === "string")
            return line;
        if (line.text)
            return line.text;
        if (line.children) {
            return line.children.map((c) => (typeof c === "string" ? c : c.text || "")).join("");
        }
        return "";
    })
        .join("\n");
}
function resolveAbsoluteImageUrl(src, siteUrl, storageBaseUrl) {
    const resolved = resolveImageUrl(src, storageBaseUrl);
    if (!resolved)
        return "";
    if (resolved.startsWith("http"))
        return resolved;
    return `${siteUrl}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}
// --- Inline text rendering ---
function renderChildrenToHtml(children) {
    if (!children || !Array.isArray(children))
        return "";
    return children
        .map((child) => {
        if (typeof child === "string")
            return escapeHtml(child);
        if (child.text !== undefined) {
            let html = escapeHtml(child.text);
            if (!html && html !== "")
                return "";
            if (child.bold)
                html = `<strong>${html}</strong>`;
            if (child.italic)
                html = `<em>${html}</em>`;
            if (child.underline)
                html = `<u>${html}</u>`;
            if (child.strikethrough)
                html = `<s>${html}</s>`;
            if (child.code)
                html = `<code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;">${html}</code>`;
            if (child.highlight)
                html = `<mark style="background:rgba(234,179,8,0.3);color:inherit;">${html}</mark>`;
            if (child.url) {
                html = `<a href="${escapeHtml(child.url)}" style="color:#888;text-decoration:underline;">${html}</a>`;
            }
            return html;
        }
        // Nested block nodes inside children
        if (child.type)
            return renderNodesToHtml([child], "", "");
        return "";
    })
        .join("");
}
// --- Block node rendering ---
function renderNodesToHtml(nodes, siteUrl, storageBaseUrl) {
    if (!Array.isArray(nodes))
        return "";
    return nodes
        .map((node) => {
        switch (node.type) {
            case "p":
            case "paragraph":
                return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#ccc;">${renderChildrenToHtml(node.children)}</p>`;
            case "h1":
            case "heading":
                if (node.type === "heading") {
                    if (node.level === 1)
                        return "";
                    if (node.level === 2)
                        return `<h2 style="margin:40px 0 16px;font-size:22px;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children)}</h2>`;
                    if (node.level === 3)
                        return `<h3 style="margin:32px 0 12px;font-size:18px;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children)}</h3>`;
                    if (node.level === 4)
                        return `<h3 style="margin:28px 0 10px;font-size:16px;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children)}</h3>`;
                    return `<h3 style="margin:24px 0 8px;font-size:15px;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children)}</h3>`;
                }
                // h1 type → skip
                return "";
            case "h2":
                return `<h2 style="margin:40px 0 16px;font-size:22px;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children)}</h2>`;
            case "h3":
                return `<h3 style="margin:32px 0 12px;font-size:18px;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children)}</h3>`;
            case "blockquote":
                return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-left:4px solid #FF6B35;padding:16px;background:#111;font-style:italic;color:#999;">${renderChildrenToHtml(node.children)}</td></tr></table>`;
            case "ul":
            case "bulletedList":
                return `<ul style="margin:0 0 16px;padding-left:24px;color:#ccc;">${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</ul>`;
            case "ol":
            case "numberedList":
                return `<ol style="margin:0 0 16px;padding-left:24px;color:#ccc;">${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</ol>`;
            case "li":
            case "listItem":
                return `<li style="margin:4px 0;font-size:15px;line-height:1.7;">${renderChildrenToHtml(node.children)}</li>`;
            case "hr":
            case "horizontalRule":
                return `<hr style="border:none;border-top:1px solid #333;margin:32px 0;" />`;
            case "callout": {
                const variant = node.variant || "info";
                const v = calloutVariants[variant] || calloutVariants.info;
                const icon = node.icon || v.icon;
                return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td style="background:${v.bg};border:1px solid ${v.border};border-radius:8px;padding:16px;color:#ccc;font-size:15px;line-height:1.7;"><span style="font-size:18px;">${icon}</span>&nbsp;&nbsp;${renderChildrenToHtml(node.children)}</td></tr></table>`;
            }
            case "code":
            case "codeBlock":
            case "code_block": {
                const raw = getCodeContent(node);
                const decoded = decodeHtmlEntities(raw);
                return `<pre style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:16px;overflow-x:auto;margin:16px 0;"><code style="font-family:monospace;font-size:13px;color:#ccc;line-height:1.6;">${escapeHtml(decoded)}</code></pre>`;
            }
            case "image":
            case "img": {
                const src = node.url || node.src || "";
                const imgUrl = resolveAbsoluteImageUrl(src, siteUrl, storageBaseUrl);
                if (!imgUrl)
                    return "";
                const alt = node.alt ? escapeHtml(node.alt) : "";
                return `<img src="${escapeHtml(imgUrl)}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;margin:24px 0;display:block;" />`;
            }
            case "table":
                return `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><tbody>${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</tbody></table>`;
            case "tr":
            case "tableRow":
                return `<tr>${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</tr>`;
            case "td":
            case "tableCell":
                return `<td style="border:1px solid #333;padding:8px 12px;font-size:13px;color:#ccc;">${renderChildrenToHtml(node.children)}</td>`;
            case "th":
            case "tableHeader":
                return `<th style="border:1px solid #333;padding:8px 12px;font-size:13px;font-weight:600;background:#1a1a1a;color:#fafafa;">${renderChildrenToHtml(node.children)}</th>`;
            case "column_group":
            case "columnGroup":
                return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr>${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</tr></table>`;
            case "column": {
                const width = node.width || "50%";
                return `<td style="padding:0 12px;vertical-align:top;" width="${escapeHtml(String(width))}">${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</td>`;
            }
            default:
                if (node.children)
                    return renderNodesToHtml(node.children, siteUrl, storageBaseUrl);
                return "";
        }
    })
        .join("");
}
// --- Main export ---
export function plateToEmailHtml(nodes, siteUrl, storageBaseUrl) {
    if (!nodes || !Array.isArray(nodes))
        return "";
    return renderNodesToHtml(nodes, siteUrl, storageBaseUrl);
}
//# sourceMappingURL=plateToEmail.js.map