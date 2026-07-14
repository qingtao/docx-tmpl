import { ScopeData } from "src/compilation/scopeData";
import { Tag } from "src/compilation/tag";
import { TemplateContext } from "src/compilation/templateContext";
import { TemplatePlugin } from "src/plugins/templatePlugin";
export declare class ImagePlugin extends TemplatePlugin {
    readonly contentType = "image";
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): Promise<void>;
    private getNextImageId;
}
