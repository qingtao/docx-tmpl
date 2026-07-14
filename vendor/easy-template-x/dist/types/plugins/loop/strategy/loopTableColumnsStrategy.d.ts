import { TextNodeTag } from "src/compilation";
import { XmlNode } from "src/xml";
import { ILoopStrategy, SplitBeforeResult } from "./iLoopStrategy";
export declare class LoopTableColumnsStrategy implements ILoopStrategy {
    isApplicable(openTag: TextNodeTag, closeTag: TextNodeTag, isCondition: boolean): boolean;
    splitBefore(openTag: TextNodeTag, closeTag: TextNodeTag): SplitBeforeResult;
    mergeBack(columnsWrapperGroups: XmlNode[][], firstCell: XmlNode, lastCell: XmlNode): void;
    private extractColumns;
    private insertColumnAfterIndex;
    private removeColumn;
    private getColumnIndex;
    private getColumnByIndex;
}
