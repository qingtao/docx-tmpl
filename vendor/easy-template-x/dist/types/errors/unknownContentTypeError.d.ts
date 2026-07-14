import { TemplateDataError } from "./templateDataError";
export declare class UnknownContentTypeError extends TemplateDataError {
    readonly tagRawText: string;
    readonly contentType: string;
    readonly path: string;
    constructor(contentType: string, tagRawText: string, path: string);
}
