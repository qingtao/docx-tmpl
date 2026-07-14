import { TemplateSyntaxError } from "./templateSyntaxError";
export declare class MissingStartDelimiterError extends TemplateSyntaxError {
    readonly closeDelimiterText: string;
    constructor(closeDelimiterText: string);
}
