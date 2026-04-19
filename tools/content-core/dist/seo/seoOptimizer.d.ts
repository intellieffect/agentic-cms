export interface SeoMetadata {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    ogImage?: string;
    ogType: string;
    ogUrl?: string;
    twitterCard: 'summary' | 'summary_large_image';
    twitterTitle: string;
    twitterDescription: string;
    twitterImage?: string;
    schemaOrg: {
        '@context': string;
        '@type': string;
        headline: string;
        description: string;
        image?: string | string[];
        datePublished: string;
        dateModified: string;
        author: {
            '@type': string;
            name: string;
        };
        publisher?: {
            '@type': string;
            name: string;
            logo?: {
                '@type': string;
                url: string;
            };
        };
        mainEntityOfPage?: {
            '@type': string;
            '@id': string;
        };
        keywords?: string;
        articleBody?: string;
        wordCount?: number;
    };
    canonicalUrl?: string;
    robots?: string;
    readingTime?: number;
}
export declare function optimizeSeoTitle(title: string, keywords: string[]): string;
export declare function optimizeSeoDescription(excerpt: string, keywords: string[]): string;
export declare function generateSchemaOrg(title: string, description: string, content: string, thumbnailUrl?: string, author?: string, publisherName?: string): SeoMetadata['schemaOrg'];
export declare function generateSeoMetadata(title: string, excerpt: string, content: string, keywords: string[], thumbnailUrl?: string, siteUrl?: string, slug?: string): SeoMetadata;
export declare function calculateSeoScore(metadata: SeoMetadata, content: string): {
    score: number;
    improvements: string[];
};
//# sourceMappingURL=seoOptimizer.d.ts.map