import { TemplateContent, TemplateData } from '../templateData';
import { Tag } from './tag';
export type PathPart = Tag | number;
export interface ScopeDataArgs {
    path: PathPart[];
    strPath: string[];
    data: TemplateData;
}
export type ScopeDataResolver = (args: ScopeDataArgs) => TemplateContent | TemplateData[];
export declare class ScopeData {
    static defaultResolver(args: ScopeDataArgs): TemplateContent | TemplateData[];
    scopeDataResolver: ScopeDataResolver;
    allData: TemplateData;
    private readonly path;
    private readonly strPath;
    constructor(data: TemplateData);
    pathPush(pathPart: PathPart): void;
    pathPop(): Tag | number;
    pathString(): string;
    getScopeData<T extends TemplateContent | TemplateData[]>(): T;
}
