export interface CategoryScores {
    topicRelevance: number;
    accuracy: number;
    originality: number;
    contentStructure: number;
    readability: number;
    generalSeo: number;
    naverOptimization: number;
    grammar: number;
    tagQuality: number;
}
export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    category: string;
    description: string;
    suggestion?: string;
}
export interface ValidationResult {
    postId: string;
    totalScore: number;
    categoryScores: CategoryScores;
    detailedAnalysis: {
        contentQuality: string;
        structureAnalysis: string;
        seoAnalysis: string;
        styleAnalysis: string;
    };
    issues: ValidationIssue[];
    improvements: string[];
    validatedBy?: string;
    validatedAt?: Date;
}
export interface ValidationHistory {
    id: string;
    postId: string;
    totalScore: number;
    categoryScores: CategoryScores;
    validatedAt: Date;
    createdAt: Date;
}
export interface ValidationStats {
    categoryId?: string;
    categoryName?: string;
    totalPosts: number;
    validatedPosts: number;
    avgTotalScore: number;
    avgCategoryScores: {
        topicRelevance: number;
        accuracy: number;
        originality: number;
        contentStructure: number;
        readability: number;
        generalSeo: number;
        naverOptimization: number;
        grammar: number;
        tagQuality: number;
    };
}
export interface ScoreDistribution {
    scoreRange: '90-100 (우수)' | '70-89 (양호)' | '50-69 (개선 필요)' | '0-49 (주의)';
    postCount: number;
}
export declare function getScoreColor(score: number): string;
export declare function getScoreEmoji(score: number): string;
export declare function getScoreLabel(score: number): string;
//# sourceMappingURL=validation.d.ts.map