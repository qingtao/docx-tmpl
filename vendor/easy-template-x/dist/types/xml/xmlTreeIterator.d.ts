import { XmlNode } from "./xmlNode";
export declare class XmlTreeIterator<T extends XmlNode = XmlNode> {
    get node(): T;
    private _current;
    private readonly depthTracker;
    constructor(initial: XmlNode, maxDepth: number);
    next(): XmlNode;
    setCurrent(node: XmlNode): void;
    private findNextNode;
}
