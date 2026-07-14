import { Delimiters } from "src/delimiters";
import { XmlNode } from "src/xml";
import { DelimiterMark } from "./delimiterMark";
export declare class DelimiterSearcher {
    private readonly maxXmlDepth;
    private readonly delimiters;
    constructor(delimiters: Delimiters, maxXmlDepth: number);
    findDelimiters(node: XmlNode): DelimiterMark[];
}
