import { TemplateSyntaxError } from "./templateSyntaxError";
export declare class UnopenedTagError extends TemplateSyntaxError {
    readonly tagName: string;
    constructor(tagName: string);
}
