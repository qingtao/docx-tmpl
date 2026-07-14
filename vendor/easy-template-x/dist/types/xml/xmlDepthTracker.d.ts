export declare class XmlDepthTracker {
    private depth;
    private readonly maxDepth;
    constructor(maxDepth: number);
    increment(): void;
    decrement(): void;
}
