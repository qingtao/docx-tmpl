import { TemplateSyntaxError } from "./templateSyntaxError";
export declare class MissingCloseDelimiterError extends TemplateSyntaxError {
    readonly openDelimiterText: string;
    constructor(openDelimiterText: string);
}
