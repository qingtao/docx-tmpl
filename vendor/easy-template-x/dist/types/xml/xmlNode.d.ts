export declare const XmlNodeType: Readonly<{
    readonly Text: "Text";
    readonly General: "General";
    readonly Comment: "Comment";
}>;
export type XmlNodeType = typeof XmlNodeType[keyof typeof XmlNodeType];
export type XmlNode = XmlTextNode | XmlGeneralNode | XmlCommentNode;
export interface XmlNodeBase {
    nodeName: string;
    parentNode?: XmlNode;
    childNodes?: XmlNode[];
    nextSibling?: XmlNode;
}
export declare const TEXT_NODE_NAME = "#text";
export declare const COMMENT_NODE_NAME = "#comment";
export interface XmlTextNode extends XmlNodeBase {
    nodeType: typeof XmlNodeType.Text;
    nodeName: typeof TEXT_NODE_NAME;
    textContent: string;
    childNodes?: never;
}
export interface XmlCommentNode extends XmlNodeBase {
    nodeType: typeof XmlNodeType.Comment;
    nodeName: typeof COMMENT_NODE_NAME;
    commentContent: string;
}
export interface XmlGeneralNode extends XmlNodeBase {
    nodeType: typeof XmlNodeType.General;
    attributes?: Record<string, string>;
}
