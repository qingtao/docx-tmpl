import { XmlGeneralNode } from "src/xml";
export declare const RelType: Readonly<{
    readonly Package: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/package";
    readonly MainDocument: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
    readonly Header: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header";
    readonly Footer: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer";
    readonly Styles: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
    readonly SharedStrings: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings";
    readonly Link: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
    readonly Image: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
    readonly Chart: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
    readonly ChartColors: "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle";
    readonly Worksheet: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
    readonly Table: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table";
}>;
export type RelTargetMode = 'Internal' | 'External';
export declare class Relationship {
    static fromXml(partDir: string, xml: XmlGeneralNode): Relationship;
    static normalizeRelTarget(partDir: string, target: string): string;
    id: string;
    type: string;
    target: string;
    targetMode: RelTargetMode;
    constructor(initial?: Partial<Relationship>);
    toXml(): XmlGeneralNode;
}
