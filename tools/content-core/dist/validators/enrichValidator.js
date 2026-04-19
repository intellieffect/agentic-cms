// 콜아웃 이모지 패턴 (줄 시작)
const CALLOUT_EMOJI_REGEX = /^[💡⚠️❌✅📝ℹ️⚡🚫❎✔️📌📋❗🔴👍]\s*/;
// 줄 단위 정규화: 마커 제거 후 텍스트만 추출
function normalizeLine(line) {
    let s = line.trim();
    // 인용구 접두사 제거
    s = s.replace(/^>\s*/, '');
    // 콜아웃 이모지 접두사 제거
    s = s.replace(CALLOUT_EMOJI_REGEX, '');
    // 인라인 하이라이트 마커 제거: ==text== → text
    s = s.replace(/==(.*?)==/g, '$1');
    // 인라인 취소선 마커 제거: ~~text~~ → text
    s = s.replace(/~~(.*?)~~/g, '$1');
    return s.trim();
}
function normalizeText(text) {
    return text
        .split('\n')
        .map(normalizeLine)
        .filter(line => line.length > 0)
        .join('\n');
}
export function validateEnrichment(original, enriched) {
    const issues = [];
    // 빈 입력 체크
    if (!original.trim()) {
        issues.push('Original text is empty');
        return { valid: false, issues };
    }
    if (!enriched.trim()) {
        issues.push('Enriched text is empty');
        return { valid: false, issues };
    }
    // 1. 텍스트 동등성 검사
    const normalizedOriginal = normalizeText(original);
    const normalizedEnriched = normalizeText(enriched);
    if (normalizedOriginal !== normalizedEnriched) {
        issues.push('Text content was modified after stripping markers');
    }
    // 2. 하이라이트 개수 검사 (==...==)
    const highlightMatches = enriched.match(/==(.*?)==/g);
    const highlightCount = highlightMatches ? highlightMatches.length : 0;
    if (highlightCount > 2) {
        issues.push(`Highlight count ${highlightCount} exceeds maximum of 2`);
    }
    // 3. 취소선 개수 검사 (~~...~~)
    const strikeMatches = enriched.match(/~~(.*?)~~/g);
    const strikeCount = strikeMatches ? strikeMatches.length : 0;
    if (strikeCount > 3) {
        issues.push(`Strikethrough count ${strikeCount} exceeds maximum of 3`);
    }
    // 4. 콜아웃 개수 검사
    const calloutLines = enriched.split('\n').filter(line => CALLOUT_EMOJI_REGEX.test(line.trim()));
    if (calloutLines.length > 1) {
        issues.push(`Callout count ${calloutLines.length} exceeds maximum of 1`);
    }
    // 5. 닫히지 않은 마커 검사
    // 하이라이트: == 개수가 홀수이면 닫히지 않은 것
    const eqParts = enriched.split('==');
    if (eqParts.length % 2 === 0) {
        issues.push('Unclosed highlight marker (==)');
    }
    // 취소선: ~~ 개수가 홀수이면 닫히지 않은 것
    const tildeParts = enriched.split('~~');
    if (tildeParts.length % 2 === 0) {
        issues.push('Unclosed strikethrough marker (~~)');
    }
    return { valid: issues.length === 0, issues };
}
//# sourceMappingURL=enrichValidator.js.map