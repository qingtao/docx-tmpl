import { Tag } from "./compilation";
import { OpenXmlPart } from "./office";
import { TemplateData } from "./templateData";
import { TemplateHandlerOptions } from "./templateHandlerOptions";
import { Binary } from "./utils";
import { XmlNode } from "./xml";
export declare class TemplateHandler {
    readonly version: string;
    private readonly compiler;
    private readonly options;
    constructor(options?: TemplateHandlerOptions);
    process<T extends Binary>(templateFile: T, data: TemplateData): Promise<T>;
    parseTags(templateFile: Binary): Promise<Tag[]>;
    getText(docxFile: Binary, relType?: string): Promise<string>;
    getXml(docxFile: Binary, relType?: string): Promise<XmlNode>;
    getParts(docxFile: Binary, relType: string): Promise<OpenXmlPart[]>;
    private callExtensions;
}
