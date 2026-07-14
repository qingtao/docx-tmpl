import { Constructor } from "src/types";
import { Binary } from "src/utils";
import { XmlNode } from "src/xml";
import { Zip } from "src/zip";
import { RelsFile } from "./relsFile";
export declare class OpenXmlPart {
    readonly rels: RelsFile;
    readonly path: string;
    private root;
    private readonly openedParts;
    private readonly zip;
    constructor(path: string, zip: Zip);
    xmlRoot(): Promise<XmlNode>;
    getText(): Promise<string>;
    getContentBinary<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
    getPartById(relId: string): Promise<OpenXmlPart>;
    getFirstPartByType(type: string): Promise<OpenXmlPart>;
    getPartsByType(type: string): Promise<OpenXmlPart[]>;
    save(binaryContent?: Binary): Promise<void>;
    private openPart;
}
