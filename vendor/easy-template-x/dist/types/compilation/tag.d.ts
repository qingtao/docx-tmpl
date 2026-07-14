import type { XmlGeneralNode, XmlTextNode } from "src/xml";
export declare const TagDisposition: Readonly<{
    readonly Open: "Open";
    readonly Close: "Close";
    readonly SelfClosed: "SelfClosed";
}>;
export type TagDisposition = typeof TagDisposition[keyof typeof TagDisposition];
export declare const TagPlacement: Readonly<{
    readonly TextNode: "TextNode";
    readonly Attribute: "Attribute";
}>;
export type TagPlacement = typeof TagPlacement[keyof typeof TagPlacement];
export type Tag = TextNodeTag | AttributeTag;
export interface BaseTag {
    name: string;
    options?: Record<string, any>;
    rawText: string;
    disposition: TagDisposition;
}
export interface TextNodeTag extends BaseTag {
    placement: typeof TagPlacement.TextNode;
    xmlTextNode: XmlTextNode;
}
export interface AttributeTag extends BaseTag {
    placement: typeof TagPlacement.Attribute;
    xmlNode: XmlGeneralNode;
    attributeName: string;
}
