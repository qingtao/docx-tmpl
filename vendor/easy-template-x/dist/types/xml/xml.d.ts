import { XmlGeneralNode, XmlNode, XmlNodeType } from "./xmlNode";
import { XmlCommentNode } from "./xmlNode";
import { XmlTextNode } from "./xmlNode";
export type NodeTypeToNode<T extends XmlNodeType> = T extends typeof XmlNodeType.Text ? XmlTextNode : T extends typeof XmlNodeType.Comment ? XmlCommentNode : T extends typeof XmlNodeType.General ? XmlGeneralNode : XmlNode;
export type XmlNodePredicate = (node: XmlNode) => boolean;
export declare class XmlUtils {
    readonly parser: Parser;
    readonly create: Create;
    readonly query: Query;
    readonly modify: Modify;
}
export interface XmlSerializationOptions {
    indent?: number;
}
declare class Parser {
    private static xmlFileHeader;
    private static readonly parser;
    parse(str: string): XmlNode;
    domParse(str: string): Document;
    encodeValue(str: string): string;
    serializeNode(node: XmlNode, options?: XmlSerializationOptions): string;
    serializeFile(xmlNode: XmlNode): string;
    private _serializeNode;
}
interface XmlGeneralNodeInit {
    attributes?: Record<string, string>;
    childNodes?: XmlNode[];
}
declare class Create {
    textNode(text?: string): XmlTextNode;
    generalNode(name: string, init?: XmlGeneralNodeInit): XmlGeneralNode;
    commentNode(text?: string): XmlCommentNode;
    cloneNode<T extends XmlNode>(node: T, deep: boolean): T;
    fromDomNode(domNode: Node): XmlNode;
}
declare class Query {
    isTextNode(node: XmlNode): node is XmlTextNode;
    isGeneralNode(node: XmlNode): node is XmlGeneralNode;
    isCommentNode(node: XmlNode): node is XmlCommentNode;
    lastTextChild(node: XmlNode, createIfMissing?: boolean): XmlTextNode;
    findParent(node: XmlNode, predicate: (node: XmlNode) => boolean): XmlGeneralNode;
    findParentByName(node: XmlNode, nodeName: string): XmlGeneralNode;
    findChild(node: XmlNode, predicate: (node: XmlNode) => boolean): XmlNode;
    findByPath<T extends XmlNodeType>(root: XmlNode, nodeType: T, ...path: (string | number)[]): NodeTypeToNode<T>;
    siblingsInRange(firstNode: XmlNode, lastNode: XmlNode): XmlNode[];
    descendants(node: XmlNode, maxDepth: number, predicate: XmlNodePredicate): XmlNode[];
}
declare class Modify {
    insertBefore(newNode: XmlNode, referenceNode: XmlNode): void;
    insertAfter(newNode: XmlNode, referenceNode: XmlNode): void;
    insertChild(parent: XmlNode, child: XmlNode, childIndex: number): void;
    appendChild(parent: XmlNode, child: XmlNode): void;
    remove(node: XmlNode): void;
    removeChild(parent: XmlNode, child: XmlNode): XmlNode;
    removeChild(parent: XmlNode, childIndex: number): XmlNode;
    removeChildren(parent: XmlNode, predicate: (child: XmlNode) => boolean): void;
    removeSiblings(from: XmlNode, to: XmlNode): XmlNode[];
    splitByChild(parent: XmlNode, child: XmlNode, removeChild: boolean): [XmlNode, XmlNode];
    removeEmptyTextNodes(node: XmlNode): void;
}
export declare const xml: XmlUtils;
export {};
