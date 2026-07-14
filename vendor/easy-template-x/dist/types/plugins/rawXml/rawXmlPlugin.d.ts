import { ScopeData } from "src/compilation/scopeData";
import { Tag } from "src/compilation/tag";
import { TemplatePlugin } from "src/plugins/templatePlugin";
export declare class RawXmlPlugin extends TemplatePlugin {
    readonly contentType = "rawXml";
    simpleTagReplacements(tag: Tag, data: ScopeData): void;
}
