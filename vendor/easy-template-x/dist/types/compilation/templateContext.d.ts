import { Docx, OpenXmlPart } from '../office';
export interface TemplateContext {
    docx: Docx;
    currentPart: OpenXmlPart;
    pluginContext: Record<string, any>;
    options: TemplateOptions;
}
export interface TemplateOptions {
    maxXmlDepth: number;
}
