import { Delimiters } from "src/delimiters";
import { XmlTreeIterator } from "src/xml";
import { DelimiterMark } from "./delimiterMark";
export declare class AttributesDelimiterSearcher {
    private readonly visitedNodes;
    private readonly delimiters;
    private readonly tagRegex;
    constructor(delimiters: Delimiters);
    processNode(it: XmlTreeIterator, delimiters: DelimiterMark[]): void;
    private shouldSearchNode;
    private isDrawingPropertiesNode;
    private findDelimiters;
    private findDelimitersInAttribute;
    private createCurrentDelimiterMark;
}
