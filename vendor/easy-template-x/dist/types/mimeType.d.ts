export declare const MimeType: Readonly<{
    readonly Png: "image/png";
    readonly Jpeg: "image/jpeg";
    readonly Gif: "image/gif";
    readonly Bmp: "image/bmp";
    readonly Svg: "image/svg+xml";
}>;
export type MimeType = typeof MimeType[keyof typeof MimeType];
export declare class MimeTypeHelper {
    static getDefaultExtension(mime: MimeType): string;
    static getOfficeRelType(mime: MimeType): string;
}
