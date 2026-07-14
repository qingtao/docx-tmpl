import { TemplatePlugin } from '../plugins';
import { XmlNode } from '../xml';
import { DelimiterSearcher } from './delimiters';
import { ScopeData } from './scopeData';
import { Tag } from './tag';
import { TagParser } from './tagParser';
import { TemplateContext } from './templateContext';
export interface TemplateCompilerOptions {
    defaultContentType: string;
    containerContentType: string;
    skipEmptyTags?: boolean;
}
export declare class TemplateCompiler {
    private readonly pluginsLookup;
    private readonly delimiterSearcher;
    private readonly tagParser;
    private readonly options;
    constructor(delimiterSearcher: DelimiterSearcher, tagParser: TagParser, plugins: TemplatePlugin[], options: TemplateCompilerOptions);
    compile(node: XmlNode, data: ScopeData, context: TemplateContext): Promise<void>;
    parseTags(node: XmlNode): Tag[];
    private doTagReplacements;
    private detectContentType;
    private simpleTagReplacements;
    private findCloseTagIndex;
}
