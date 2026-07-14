import { OpenXmlPart } from "src/office";
import { XmlGeneralNode, XmlTextNode } from "src/xml";
import { TagPlacement } from "src/compilation/tag";
export type DelimiterMark = TextNodeDelimiterMark | AttributeDelimiterMark;
export interface BaseDelimiterMark {
    openXmlPart?: OpenXmlPart;
    isOpen: boolean;
}
export interface TextNodeDelimiterMark extends BaseDelimiterMark {
    placement: typeof TagPlacement.TextNode;
    xmlTextNode: XmlTextNode;
    index: number;
}
export interface AttributeDelimiterMark extends BaseDelimiterMark {
    placement: typeof TagPlacement.Attribute;
    xmlNode: XmlGeneralNode;
    attributeName: string;
    index: number;
}
