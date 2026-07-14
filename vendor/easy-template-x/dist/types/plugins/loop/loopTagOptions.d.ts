export declare const LoopOver: Readonly<{
    readonly Row: "row";
    readonly Column: "column";
    readonly Paragraph: "paragraph";
    readonly Content: "content";
}>;
export type LoopOver = typeof LoopOver[keyof typeof LoopOver];
export declare class LoopTagOptions {
    loopOver: LoopOver;
}
