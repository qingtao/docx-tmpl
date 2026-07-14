import { ScopeData } from "src/compilation/scopeData";
import { Tag } from "src/compilation/tag";
import { TemplateContext } from "src/compilation/templateContext";
import { PluginUtilities, TemplatePlugin } from "src/plugins/templatePlugin";
export declare const LOOP_CONTENT_TYPE = "loop";
export declare class LoopPlugin extends TemplatePlugin {
    readonly contentType = "loop";
    private readonly loopStrategies;
    setUtilities(utilities: PluginUtilities): void;
    containerTagReplacements(tags: Tag[], data: ScopeData, context: TemplateContext): Promise<void>;
    private repeat;
    private compile;
    private updatePathBefore;
    private updatePathAfter;
}
