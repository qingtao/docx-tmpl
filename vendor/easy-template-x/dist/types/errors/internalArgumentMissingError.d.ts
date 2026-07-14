import { InternalError } from "./internalError";
export declare class InternalArgumentMissingError extends InternalError {
    readonly argName: string;
    constructor(argName: string);
}
