import { ScopeDataResolver } from './compilation';
import { Delimiters } from './delimiters';
import { ExtensionOptions } from './extensions';
import { TemplatePlugin } from './plugins';
export declare class TemplateHandlerOptions {
    plugins?: TemplatePlugin[];
    skipEmptyTags?: boolean;
    defaultContentType?: string;
    containerContentType?: string;
    delimiters?: Partial<Delimiters>;
    maxXmlDepth?: number;
    extensions?: ExtensionOptions;
    scopeDataResolver?: ScopeDataResolver;
    constructor(initial?: Partial<TemplateHandlerOptions>);
}
