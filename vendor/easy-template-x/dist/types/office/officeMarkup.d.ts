import { Tag } from "src/compilation/tag";
import { XmlGeneralNode, XmlNode, XmlTextNode } from "src/xml";
export declare class OfficeMarkup {
    readonly query: Query;
    readonly modify: Modify;
}
declare class Query {
    isTextNode(node: XmlNode): boolean;
    isRunNode(node: XmlNode): boolean;
    isRunPropertiesNode(node: XmlNode): boolean;
    isTableNode(node: XmlNode): boolean;
    isTableCellNode(node: XmlNode): boolean;
    isParagraphNode(node: XmlNode): boolean;
    isParagraphPropertiesNode(node: XmlNode): boolean;
    isListParagraph(paragraphNode: XmlNode): boolean;
    isInlineDrawingNode(node: XmlNode): boolean;
    findParagraphPropertiesNode(paragraphNode: XmlNode): XmlNode;
    firstTextNodeChild(node: XmlNode): XmlNode;
    containingTextNode(node: XmlTextNode): XmlGeneralNode;
    containingRunNode(node: XmlNode): XmlGeneralNode;
    containingParagraphNode(node: XmlNode): XmlGeneralNode;
    containingTableRowNode(node: XmlNode): XmlGeneralNode;
    containingTableCellNode(node: XmlNode): XmlGeneralNode;
    containingTableNode(node: XmlNode): XmlGeneralNode;
    containingStructuredTagContentNode(node: XmlNode): XmlGeneralNode;
    isEmptyTextNode(node: XmlNode): boolean;
    isEmptyRun(node: XmlNode): boolean;
}
declare class Modify {
    splitTextNode(textNode: XmlTextNode, splitIndex: number, addBefore: boolean): XmlTextNode;
    splitParagraphByTextNode(paragraph: XmlNode, textNode: XmlTextNode, removeTextNode: boolean): [XmlNode, XmlNode];
    joinTextNodesRange(from: XmlTextNode, to: XmlTextNode): void;
    joinParagraphs(first: XmlNode, second: XmlNode): void;
    setSpacePreserveAttribute(node: XmlGeneralNode): void;
    removeTag(tag: Tag): void;
}
export declare const officeMarkup: OfficeMarkup;
export {};
