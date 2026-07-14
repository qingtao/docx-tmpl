import { Constructor } from "src/types";
import { Binary } from "src/utils";
import { Zip } from "src/zip";
import { OpenXmlPart } from "./openXmlPart";
export declare class Xlsx {
    static load(file: Binary): Promise<Xlsx>;
    static open(zip: Zip): Promise<Xlsx>;
    private static getMainDocumentPath;
    readonly mainDocument: OpenXmlPart;
    private readonly _parts;
    private readonly zip;
    get rawZipFile(): Zip;
    private constructor();
    export<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
    private saveXmlChanges;
}
