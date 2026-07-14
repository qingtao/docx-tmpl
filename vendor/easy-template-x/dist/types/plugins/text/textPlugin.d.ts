import { ScopeData } from "src/compilation/scopeData";
import { Tag } from "src/compilation/tag";
import { TemplatePlugin } from "src/plugins/templatePlugin";
export declare const TEXT_CONTENT_TYPE = "text";
export declare class TextPlugin extends TemplatePlugin {
    readonly contentType = "text";
    simpleTagReplacements(tag: Tag, data: ScopeData): void;
    private replaceInTextNode;
    private replaceInAttribute;
    private replaceSingleLine;
    private replaceMultiLine;
    private getLineBreak;
    private createOfficeTextNode;
}
