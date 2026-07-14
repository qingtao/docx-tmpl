import { XmlTreeIterator } from "src/xml";
import { DelimiterMark } from "./delimiterMark";
export declare class TextNodesDelimiterSearcher {
    private lookForOpenDelimiter;
    private lookForDelimiterIndex;
    private matchOpenNodes;
    private firstMatchIndex;
    private readonly startDelimiter;
    private readonly endDelimiter;
    constructor(startDelimiter: string, endDelimiter: string);
    processNode(it: XmlTreeIterator, delimiters: DelimiterMark[]): void;
    private resetMatch;
    private shouldSearchNode;
    private findDelimiters;
    private noMatch;
    private fullMatch;
    private createCurrentDelimiterMark;
}
