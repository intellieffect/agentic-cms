export type OpeningStyle = 'episode' | 'question' | 'dialogue' | 'declaration' | 'monologue';
export type ClosingStyle = 'cut' | 'afterthought' | 'fact' | 'question' | 'none';
export interface StylePreset {
    opening: OpeningStyle;
    closing: ClosingStyle;
}
export declare function selectPreset(recentPresets: StylePreset[]): StylePreset;
export declare function presetToPromptText(preset: StylePreset): string;
//# sourceMappingURL=stylePresets.d.ts.map