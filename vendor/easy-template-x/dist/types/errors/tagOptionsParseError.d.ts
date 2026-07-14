import { TemplateSyntaxError } from "./templateSyntaxError";
export declare class TagOptionsParseError extends TemplateSyntaxError {
    readonly tagRawText: string;
    readonly parseError: Error;
    constructor(tagRawText: string, parseError: Error);
}
