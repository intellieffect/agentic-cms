export interface ContentGuideline {
    title: string;
    description: string;
    rules: string[];
    examples?: {
        good: string[];
        bad: string[];
    };
}
export declare const contentGuidelines: Record<string, ContentGuideline>;
export declare function validateContentGuidelines(content: string): {
    valid: boolean;
    violations: string[];
    suggestions: string[];
};
//# sourceMappingURL=contentGuidelines.d.ts.map