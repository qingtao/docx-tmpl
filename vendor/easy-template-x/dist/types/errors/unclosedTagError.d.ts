import { TemplateSyntaxError } from "./templateSyntaxError";
export declare class UnclosedTagError extends TemplateSyntaxError {
    readonly tagName: string;
    constructor(tagName: string);
}
