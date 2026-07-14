declare class W {
    readonly Paragraph = "w:p";
    readonly ParagraphProperties = "w:pPr";
    readonly Run = "w:r";
    readonly RunProperties = "w:rPr";
    readonly Text = "w:t";
    readonly Table = "w:tbl";
    readonly TableRow = "w:tr";
    readonly TableCell = "w:tc";
    readonly Drawing = "w:drawing";
    readonly NumberProperties = "w:numPr";
    readonly StructuredTag = "w:sdt";
    readonly StructuredTagProperties = "w:sdtPr";
    readonly StructuredTagContent = "w:sdtContent";
    readonly FieldChar = "w:fldChar";
}
declare class A {
    readonly Paragraph = "a:p";
    readonly ParagraphProperties = "a:pPr";
    readonly Run = "a:r";
    readonly RunProperties = "a:rPr";
    readonly Text = "a:t";
    readonly Graphic = "a:graphic";
    readonly GraphicData = "a:graphicData";
    readonly Blip = "a:blip";
    readonly AlphaModFix = "a:alphaModFix";
}
declare class Wp {
    readonly DocPr = "wp:docPr";
    readonly Inline = "wp:inline";
    readonly FloatingAnchor = "wp:anchor";
    readonly Extent = "wp:extent";
}
declare class Pic {
    readonly Pic = "pic:pic";
    readonly NvPicPr = "pic:nvPicPr";
    readonly CnVPr = "pic:cNvPr";
    readonly BlipFill = "pic:blipFill";
    readonly SpPr = "pic:spPr";
    readonly Xfrm = "a:xfrm";
    readonly Ext = "a:ext";
}
export declare class OmlNode {
    static readonly W: W;
    static readonly A: A;
    static readonly Wp: Wp;
    static readonly Pic: Pic;
}
export declare class OmlAttribute {
    static readonly SpacePreserve = "xml:space";
    static readonly FieldCharType = "w:fldCharType";
}
export {};
