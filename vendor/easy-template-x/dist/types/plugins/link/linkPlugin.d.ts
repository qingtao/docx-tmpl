import { ScopeData } from "src/compilation/scopeData";
import { Tag } from "src/compilation/tag";
import { TemplateContext } from "src/compilation/templateContext";
import { TemplatePlugin } from "src/plugins/templatePlugin";
export declare class LinkPlugin extends TemplatePlugin {
    readonly contentType = "link";
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): Promise<void>;
    private generateMarkup;
    private insertHyperlinkNode;
}
