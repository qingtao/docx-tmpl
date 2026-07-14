import { ScopeData, TagParser, TemplateCompiler, TemplateContext } from 'src/compilation';
export interface ExtensionUtilities {
    compiler: TemplateCompiler;
    tagParser: TagParser;
}
export declare abstract class TemplateExtension {
    protected utilities: ExtensionUtilities;
    setUtilities(utilities: ExtensionUtilities): void;
    abstract execute(data: ScopeData, context: TemplateContext): void | Promise<void>;
}
