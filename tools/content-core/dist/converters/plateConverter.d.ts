import { PlateNode } from '../types/plate.js';
export type ImageResolver = (description: string) => Promise<{
    url: string;
    credit?: string;
} | null>;
export interface ConversionResult {
    content: PlateNode[];
    images: Array<{
        description: string;
        url: string;
        credit?: string;
        position: number;
    }>;
}
export declare function convertToPlateFormat(content: string, context?: {
    topic: string;
    category: string;
}, imageResolver?: ImageResolver): Promise<ConversionResult>;
export declare function convertToPlateFormatBasic(content: string, context?: {
    topic: string;
    category: string;
}, imageResolver?: ImageResolver): Promise<ConversionResult>;
export declare const convertToPlateFormatAdvanced: typeof convertToPlateFormat;
export declare function extractImageDescriptions(content: string): string[];
//# sourceMappingURL=plateConverter.d.ts.map