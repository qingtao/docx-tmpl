import { TextNodeTag } from "src/compilation";
import { XmlNode } from "src/xml";
import { ILoopStrategy, SplitBeforeResult } from "./iLoopStrategy";
export declare class LoopListStrategy implements ILoopStrategy {
    isApplicable(openTag: TextNodeTag, closeTag: TextNodeTag, isCondition: boolean): boolean;
    splitBefore(openTag: TextNodeTag, closeTag: TextNodeTag): SplitBeforeResult;
    mergeBack(paragraphGroups: XmlNode[][], firstParagraph: XmlNode, lastParagraphs: XmlNode): void;
}
