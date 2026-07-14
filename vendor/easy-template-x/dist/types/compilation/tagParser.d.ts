import { Delimiters } from "src/delimiters";
import { DelimiterMark } from "./delimiters";
import { Tag } from "./tag";
export declare class TagParser {
    private readonly tagRegex;
    private readonly delimiters;
    constructor(delimiters: Delimiters);
    parse(delimiters: DelimiterMark[]): Tag[];
    private processDelimiter;
    private getPartialTagText;
    private processDelimiterPair;
    private processTextNodeDelimiterPair;
    private processAttributeDelimiterPair;
    private normalizeTextTagNodes;
    private populateTagFields;
}
