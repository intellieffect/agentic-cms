const OPENING_EXAMPLES = {
    episode: '며칠 뒤 연락이 왔습니다. 잠을 못 자겠다고.',
    question: '맥미니 사놓고 뭐 하세요?',
    dialogue: '코드 안 짜는 개발자한테 뭐 하냐고 물었더니.',
    declaration: '직원 없습니다.',
    monologue: '허허. 1년이 안 됐다니.',
};
const CLOSING_EXAMPLES = {
    cut: '마무리 없이 뚝 끊기. 마지막 문장이 멋있을 필요 없음.',
    afterthought: '퇴근은 없고. 출근도 없지만.',
    fact: '$200이 아깝지가 않더군요.',
    question: '질문으로 끝. 답 안 줌.',
    none: '의도적 마무리 없음. 그냥 끝.',
};
const ALL_OPENINGS = ['episode', 'question', 'dialogue', 'declaration', 'monologue'];
const ALL_CLOSINGS = ['cut', 'afterthought', 'fact', 'question', 'none'];
export function selectPreset(recentPresets) {
    const recent = recentPresets.slice(0, 3);
    const recentOpenings = new Set(recent.map(p => p.opening));
    const recentClosings = new Set(recent.map(p => p.closing));
    const candidates = [];
    for (const opening of ALL_OPENINGS) {
        if (recentOpenings.has(opening))
            continue;
        for (const closing of ALL_CLOSINGS) {
            if (recentClosings.has(closing))
                continue;
            // opening=question + closing=question 금지
            if (opening === 'question' && closing === 'question')
                continue;
            candidates.push({ opening, closing });
        }
    }
    // 후보가 없으면 (극단적 케이스 — 5×5에서 3개 제외 시 실질적으로 도달 불가하나 방어적 fallback)
    if (candidates.length === 0) {
        for (const opening of ALL_OPENINGS) {
            if (recentOpenings.has(opening))
                continue;
            for (const closing of ALL_CLOSINGS) {
                if (opening === 'question' && closing === 'question')
                    continue;
                candidates.push({ opening, closing });
            }
        }
    }
    // 그래도 없으면 closing만 겹치지 않도록
    if (candidates.length === 0) {
        for (const opening of ALL_OPENINGS) {
            for (const closing of ALL_CLOSINGS) {
                if (recentClosings.has(closing))
                    continue;
                if (opening === 'question' && closing === 'question')
                    continue;
                candidates.push({ opening, closing });
            }
        }
    }
    // 최후의 수단: 아무거나 (question+question 제외)
    if (candidates.length === 0) {
        for (const opening of ALL_OPENINGS) {
            for (const closing of ALL_CLOSINGS) {
                if (opening === 'question' && closing === 'question')
                    continue;
                candidates.push({ opening, closing });
            }
        }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}
export function presetToPromptText(preset) {
    const openingExample = OPENING_EXAMPLES[preset.opening];
    const closingExample = CLOSING_EXAMPLES[preset.closing];
    return [
        `이번 글의 시작은 이런 느낌으로: "${openingExample}"`,
        `이번 글의 끝은 이런 느낌으로: "${closingExample}"`,
    ].join('\n');
}
//# sourceMappingURL=stylePresets.js.map