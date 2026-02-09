declare module 'exif-parser' {
    export interface ExifParser {
        parse(): ExifResult;
    }
    export interface ExifResult {
        tags: Record<string, any>;
        imageSize: { width: number; height: number };
    }
    export function create(buffer: Buffer): ExifParser;
}
