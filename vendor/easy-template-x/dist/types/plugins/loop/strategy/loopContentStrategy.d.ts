import { TextNodeTag } from "src/compilation";
import { XmlNode } from "src/xml";
import { ILoopStrategy, SplitBeforeResult } from "./iLoopStrategy";
export declare class LoopContentStrategy implements ILoopStrategy {
    isApplicable(openTag: TextNodeTag, closeTag: TextNodeTag, isCondition: boolean): boolean;
    splitBefore(openTag: TextNodeTag, closeTag: TextNodeTag): SplitBeforeResult;
    mergeBack(middleParagraphs: XmlNode[][], firstParagraph: XmlNode, lastParagraph: XmlNode): void;
}
