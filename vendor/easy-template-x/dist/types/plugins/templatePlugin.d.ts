import { ScopeData, Tag, TemplateCompiler, TemplateContext } from "../compilation";
export interface PluginUtilities {
    compiler: TemplateCompiler;
}
export declare abstract class TemplatePlugin {
    abstract readonly contentType: string;
    protected utilities: PluginUtilities;
    setUtilities(utilities: PluginUtilities): void;
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): void | Promise<void>;
    containerTagReplacements(tags: Tag[], data: ScopeData, context: TemplateContext): void | Promise<void>;
}
