import { Constructor } from "src/types";
import { Binary } from "src/utils";
import { Zip } from "src/zip";
import { ContentTypesFile } from "./contentTypesFile";
import { MediaFiles } from "./mediaFiles";
import { OpenXmlPart } from "./openXmlPart";
export declare class Docx {
    static load(file: Binary): Promise<Docx>;
    static open(zip: Zip): Promise<Docx>;
    private static getMainDocumentPath;
    readonly mainDocument: OpenXmlPart;
    readonly mediaFiles: MediaFiles;
    readonly contentTypes: ContentTypesFile;
    private readonly zip;
    get rawZipFile(): Zip;
    private constructor();
    getContentParts(): Promise<OpenXmlPart[]>;
    export<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
}
