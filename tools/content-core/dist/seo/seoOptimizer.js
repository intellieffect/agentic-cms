// SEO 제목 최적화 (네이버 블로그 최적화 반영)
export function optimizeSeoTitle(title, keywords) {
    // 네이버는 제목 25자 이내 권장, 구글은 50-60자
    // 한글 기준으로 25자, 영문 포함 시 최대 35자까지 허용
    let optimizedTitle = title;
    // 주요 키워드가 제목에 없으면 추가
    const primaryKeyword = keywords[0];
    if (primaryKeyword && !title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        // 키워드를 제목 앞쪽에 자연스럽게 배치
        optimizedTitle = `${primaryKeyword} ${title}`;
    }
    // 한글 문자 수 계산 (영문은 0.5자로 계산)
    const calculateLength = (str) => {
        let length = 0;
        for (const char of str) {
            if (/[ㄱ-힝]/.test(char)) {
                length += 1; // 한글
            }
            else {
                length += 0.5; // 영문 및 기타
            }
        }
        return length;
    };
    const titleLength = calculateLength(optimizedTitle);
    // 네이버 최적 길이는 25자
    if (titleLength > 25) {
        // 제목이 길면 뒤를 잘라내되, 키워드는 보존
        const words = optimizedTitle.split(' ');
        let newTitle = '';
        let currentLength = 0;
        for (const word of words) {
            const wordLength = calculateLength(word);
            if (currentLength + wordLength <= 23) { // 여유분 2자
                newTitle += (newTitle ? ' ' : '') + word;
                currentLength += wordLength + (newTitle ? 0.5 : 0); // 띄어쓰기
            }
            else {
                break;
            }
        }
        optimizedTitle = newTitle;
    }
    return optimizedTitle;
}
// SEO 설명 최적화
export function optimizeSeoDescription(excerpt, keywords) {
    let description = excerpt;
    // 설명 길이 체크 (150-160자 권장)
    if (description.length < 120) {
        // 너무 짧으면 키워드 추가
        const additionalKeywords = keywords.slice(0, 2).join(', ');
        description = `${description} ${additionalKeywords}에 대한 자세한 정보를 확인하세요.`;
    }
    // 최대 길이 제한 (160자)
    if (description.length > 160) {
        description = description.substring(0, 157) + '...';
    }
    // 특수문자 제거 (메타 태그에서 문제 일으킬 수 있는 것들)
    description = description.replace(/["'<>]/g, '');
    return description;
}
// 구조화된 데이터 생성
export function generateSchemaOrg(title, description, content, thumbnailUrl, author = 'AI Blog Writer', publisherName = 'My Blog') {
    const now = new Date().toISOString();
    // 단어 수 계산
    const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description: description,
        image: thumbnailUrl ? [thumbnailUrl] : undefined,
        datePublished: now,
        dateModified: now,
        author: {
            '@type': 'Person',
            name: author
        },
        publisher: {
            '@type': 'Organization',
            name: publisherName,
            logo: {
                '@type': 'ImageObject',
                url: 'https://example.com/logo.png' // 실제 로고 URL로 변경 필요
            }
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': '' // URL은 나중에 설정
        },
        articleBody: content.substring(0, 1000), // 일부만 포함
        wordCount: wordCount,
        keywords: '' // 나중에 설정
    };
}
// 전체 SEO 메타데이터 생성
export function generateSeoMetadata(title, excerpt, content, keywords, thumbnailUrl, siteUrl, slug) {
    // SEO 최적화된 제목과 설명
    const seoTitle = optimizeSeoTitle(title, keywords);
    const seoDescription = optimizeSeoDescription(excerpt, keywords);
    // 페이지 URL
    const pageUrl = siteUrl && slug ? `${siteUrl}/${slug}` : undefined;
    // 구조화된 데이터
    const schemaOrg = generateSchemaOrg(seoTitle, seoDescription, content, thumbnailUrl);
    // mainEntityOfPage URL 설정
    if (pageUrl && schemaOrg.mainEntityOfPage) {
        schemaOrg.mainEntityOfPage['@id'] = pageUrl;
    }
    // 키워드 문자열
    schemaOrg.keywords = keywords.join(', ');
    return {
        // 기본 메타 태그
        title: seoTitle,
        description: seoDescription,
        keywords: keywords,
        // Open Graph
        ogTitle: seoTitle,
        ogDescription: seoDescription,
        ogImage: thumbnailUrl,
        ogType: 'article',
        ogUrl: pageUrl,
        // Twitter Card
        twitterCard: thumbnailUrl ? 'summary_large_image' : 'summary',
        twitterTitle: seoTitle,
        twitterDescription: seoDescription,
        twitterImage: thumbnailUrl,
        // 구조화된 데이터
        schemaOrg: schemaOrg,
        // 추가 SEO 속성
        canonicalUrl: pageUrl,
        robots: 'index, follow',
        readingTime: Math.ceil(content.length / 500) // 한글 기준 분당 500자
    };
}
// SEO 점수 계산
export function calculateSeoScore(metadata, content) {
    let score = 0;
    const improvements = [];
    const maxScore = 100;
    // 제목 점수 (20점)
    if (metadata.title.length >= 30 && metadata.title.length <= 60) {
        score += 20;
    }
    else {
        score += 10;
        improvements.push('제목 길이를 30-60자로 조정하세요');
    }
    // 설명 점수 (20점)
    if (metadata.description.length >= 120 && metadata.description.length <= 160) {
        score += 20;
    }
    else {
        score += 10;
        improvements.push('메타 설명 길이를 120-160자로 조정하세요');
    }
    // 키워드 점수 (15점)
    if (metadata.keywords.length >= 3 && metadata.keywords.length <= 7) {
        score += 15;
    }
    else {
        score += 7;
        improvements.push('키워드를 3-7개로 조정하세요');
    }
    // 이미지 점수 (15점)
    if (metadata.ogImage) {
        score += 15;
    }
    else {
        improvements.push('썸네일 이미지를 추가하세요');
    }
    // 구조화된 데이터 점수 (15점)
    if (metadata.schemaOrg) {
        score += 15;
    }
    // 콘텐츠 길이 점수 (15점) - 네이버 블로그 최적화
    // 네이버는 1,900-2,100자 권장 (한글 기준)
    const charCount = content.replace(/\s/g, '').length;
    if (charCount >= 1900 && charCount <= 2100) {
        score += 15;
    }
    else if (charCount >= 1800 && charCount <= 2200) {
        score += 12;
    }
    else if (charCount < 1800) {
        score += 5;
        improvements.push('콘텐츠를 1,900-2,100자로 늘리세요 (현재 ' + charCount + '자)');
    }
    else {
        score += 10;
        improvements.push('콘텐츠가 너무 깁니다. 1,900-2,100자 권장 (현재 ' + charCount + '자)');
    }
    return {
        score: Math.round((score / maxScore) * 100),
        improvements
    };
}
//# sourceMappingURL=seoOptimizer.js.map