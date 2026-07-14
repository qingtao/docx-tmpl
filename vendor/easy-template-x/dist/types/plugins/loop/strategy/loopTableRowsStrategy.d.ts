import { TextNodeTag } from "src/compilation";
import { XmlNode } from "src/xml";
import { ILoopStrategy, SplitBeforeResult } from "./iLoopStrategy";
export declare class LoopTableRowsStrategy implements ILoopStrategy {
    isApplicable(openTag: TextNodeTag, closeTag: TextNodeTag, isCondition: boolean): boolean;
    splitBefore(openTag: TextNodeTag, closeTag: TextNodeTag): SplitBeforeResult;
    mergeBack(rowGroups: XmlNode[][], firstRow: XmlNode, lastRow: XmlNode): void;
}
