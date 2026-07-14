import { MimeType } from "src/mimeType";
import { Zip } from "src/zip";
export declare class ContentTypesFile {
    private static readonly contentTypesFilePath;
    private addedNew;
    private root;
    private contentTypes;
    private readonly zip;
    constructor(zip: Zip);
    ensureContentType(mime: MimeType): Promise<void>;
    xmlString(): Promise<string>;
    save(): Promise<void>;
    private parseContentTypesFile;
}
