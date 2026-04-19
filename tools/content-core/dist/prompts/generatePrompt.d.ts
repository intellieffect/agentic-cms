import { StylePreset } from './stylePresets.js';
export interface GeneratePromptOptions {
    category: string;
    topic: string;
    keywords?: string[];
    stylePreset?: StylePreset;
}
export declare function createGeneratePrompt(options: GeneratePromptOptions): string;
export declare function validateContentLength(content: string): {
    valid: boolean;
    length: number;
    message: string;
    severity?: 'warning' | 'error';
};
export declare function validateImageCount(content: string): {
    valid: boolean;
    count: number;
    message: string;
};
//# sourceMappingURL=generatePrompt.d.ts.map