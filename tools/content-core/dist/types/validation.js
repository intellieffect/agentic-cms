// 블로그 게시글 검증 관련 타입 정의
// 점수에 따른 색상 및 아이콘 헬퍼
export function getScoreColor(score) {
    if (score >= 90)
        return '#10b981'; // green-500
    if (score >= 70)
        return '#f59e0b'; // yellow-500
    if (score >= 50)
        return '#f97316'; // orange-500
    return '#ef4444'; // red-500
}
export function getScoreEmoji(score) {
    if (score >= 90)
        return '🟢';
    if (score >= 70)
        return '🟡';
    if (score >= 50)
        return '🟠';
    return '🔴';
}
export function getScoreLabel(score) {
    if (score >= 90)
        return '우수';
    if (score >= 70)
        return '양호';
    if (score >= 50)
        return '개선 필요';
    return '주의';
}
//# sourceMappingURL=validation.js.map