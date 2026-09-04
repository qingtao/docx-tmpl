import JSZip from 'jszip';

interface Constructor<T> {
    new (...args: any[]): T;
}

type ItemMapper<TIn, TOut = string> = (item: TIn, index: number) => TOut;
declare function pushMany<T>(destArray: T[], items: T[]): void;
declare function first<T>(array: T[]): T;
declare function last<T>(array: T[]): T;
declare function toDictionary<TIn, TOut = TIn>(array: TIn[], keySelector: ItemMapper<TIn>, valueSelector?: ItemMapper<TIn, TOut>): Record<string, TOut>;

declare class Base64 {
    static encode(str: string): string;
}

type Binary = Blob | Buffer | ArrayBuffer;
declare const Binary: {
    isBlob(binary: unknown): binary is Blob;
    isArrayBuffer(binary: unknown): binary is ArrayBuffer;
    isBuffer(binary: unknown): binary is Buffer;
    isBlobConstructor(binaryType: Constructor<unknown>): binaryType is Constructor<Blob>;
    isArrayBufferConstructor(binaryType: Constructor<unknown>): binaryType is Constructor<ArrayBuffer>;
    isBufferConstructor(binaryType: Constructor<unknown>): binaryType is Constructor<Buffer>;
    toBase64(binary: Binary): Promise<string>;
};

declare function isNumber(value: unknown): value is number;

declare class Path {
    static getFilename(path: string): string;
    static getDirectory(path: string): string;
    static combine(...parts: string[]): string;
}

declare class Regex {
    static escape(str: string): string;
}

declare function sha1(msg: string): string;

declare function stringValue(val: unknown): string;
declare function normalizeDoubleQuotes(text: string): string;
declare function countOccurrences(text: string, substring: string): number;

declare function inheritsFrom(derived: Constructor<any>, base: Constructor<any>): boolean;
declare function isPromiseLike<T>(candidate: unknown): candidate is PromiseLike<T>;

declare class ZipObject {
    get name(): string;
    set name(value: string);
    get isDirectory(): boolean;
    private readonly zipObject;
    private readonly binaryFormat;
    constructor(zipObject: JSZip.JSZipObject, binaryFormat: Constructor<Binary>);
    getContentText(): Promise<string>;
    getContentBase64(): Promise<string>;
    getContentBinary<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
}

declare class Zip {
    static load(file: Binary): Promise<Zip>;
    private readonly zip;
    private readonly binaryFormat;
    private constructor();
    getFile(path: string): ZipObject;
    setFile(path: string, content: string | Binary): void;
    isFileExist(path: string): boolean;
    listFiles(): string[];
    export<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
}

declare const MimeType: Readonly<{
    readonly Png: "image/png";
    readonly Jpeg: "image/jpeg";
    readonly Gif: "image/gif";
    readonly Bmp: "image/bmp";
    readonly Svg: "image/svg+xml";
}>;
type MimeType = typeof MimeType[keyof typeof MimeType];
declare class MimeTypeHelper {
    static getDefaultExtension(mime: MimeType): string;
    static getOfficeRelType(mime: MimeType): string;
}

declare class ContentTypesFile {
    private static readonly contentTypesFilePath;
    private addedNew;
    private root;
    private contentTypes;
    private readonly zip;
    constructor(zip: Zip);
    ensureContentType(mime: MimeType): Promise<void>;
    xmlString(): Promise<string>;
    save(): Promise<void>;
    private parseContentTypesFile;
}

declare class MediaFiles {
    private static readonly mediaDir;
    private hashes;
    private readonly files;
    private nextFileId;
    private readonly zip;
    constructor(zip: Zip);
    add(mediaFile: Binary, mime: MimeType): Promise<string>;
    count(): Promise<number>;
    private hashMediaFiles;
    private baseFilename;
}

declare const XmlNodeType: Readonly<{
    readonly Text: "Text";
    readonly General: "General";
    readonly Comment: "Comment";
}>;
type XmlNodeType = typeof XmlNodeType[keyof typeof XmlNodeType];
type XmlNode = XmlTextNode | XmlGeneralNode | XmlCommentNode;
interface XmlNodeBase {
    nodeName: string;
    parentNode?: XmlNode;
    childNodes?: XmlNode[];
    nextSibling?: XmlNode;
}
declare const TEXT_NODE_NAME = "#text";
declare const COMMENT_NODE_NAME = "#comment";
interface XmlTextNode extends XmlNodeBase {
    nodeType: typeof XmlNodeType.Text;
    nodeName: typeof TEXT_NODE_NAME;
    textContent: string;
    childNodes?: never;
}
interface XmlCommentNode extends XmlNodeBase {
    nodeType: typeof XmlNodeType.Comment;
    nodeName: typeof COMMENT_NODE_NAME;
    commentContent: string;
}
interface XmlGeneralNode extends XmlNodeBase {
    nodeType: typeof XmlNodeType.General;
    attributes?: Record<string, string>;
}

type NodeTypeToNode<T extends XmlNodeType> = T extends typeof XmlNodeType.Text ? XmlTextNode : T extends typeof XmlNodeType.Comment ? XmlCommentNode : T extends typeof XmlNodeType.General ? XmlGeneralNode : XmlNode;
type XmlNodePredicate = (node: XmlNode) => boolean;
declare class XmlUtils {
    readonly parser: Parser;
    readonly create: Create;
    readonly query: Query$1;
    readonly modify: Modify$1;
}
interface XmlSerializationOptions {
    indent?: number;
}
declare class Parser {
    private static xmlFileHeader;
    private static readonly parser;
    parse(str: string): XmlNode;
    domParse(str: string): Document;
    encodeValue(str: string): string;
    serializeNode(node: XmlNode, options?: XmlSerializationOptions): string;
    serializeFile(xmlNode: XmlNode): string;
    private _serializeNode;
}
interface XmlGeneralNodeInit {
    attributes?: Record<string, string>;
    childNodes?: XmlNode[];
}
declare class Create {
    textNode(text?: string): XmlTextNode;
    generalNode(name: string, init?: XmlGeneralNodeInit): XmlGeneralNode;
    commentNode(text?: string): XmlCommentNode;
    cloneNode<T extends XmlNode>(node: T, deep: boolean): T;
    fromDomNode(domNode: Node): XmlNode;
}
declare class Query$1 {
    isTextNode(node: XmlNode): node is XmlTextNode;
    isGeneralNode(node: XmlNode): node is XmlGeneralNode;
    isCommentNode(node: XmlNode): node is XmlCommentNode;
    lastTextChild(node: XmlNode, createIfMissing?: boolean): XmlTextNode;
    findParent(node: XmlNode, predicate: (node: XmlNode) => boolean): XmlGeneralNode;
    findParentByName(node: XmlNode, nodeName: string): XmlGeneralNode;
    findChild(node: XmlNode, predicate: (node: XmlNode) => boolean): XmlNode;
    findByPath<T extends XmlNodeType>(root: XmlNode, nodeType: T, ...path: (string | number)[]): NodeTypeToNode<T>;
    siblingsInRange(firstNode: XmlNode, lastNode: XmlNode): XmlNode[];
    descendants(node: XmlNode, maxDepth: number, predicate: XmlNodePredicate): XmlNode[];
}
declare class Modify$1 {
    insertBefore(newNode: XmlNode, referenceNode: XmlNode): void;
    insertAfter(newNode: XmlNode, referenceNode: XmlNode): void;
    insertChild(parent: XmlNode, child: XmlNode, childIndex: number): void;
    appendChild(parent: XmlNode, child: XmlNode): void;
    remove(node: XmlNode): void;
    removeChild(parent: XmlNode, child: XmlNode): XmlNode;
    removeChild(parent: XmlNode, childIndex: number): XmlNode;
    removeChildren(parent: XmlNode, predicate: (child: XmlNode) => boolean): void;
    removeSiblings(from: XmlNode, to: XmlNode): XmlNode[];
    splitByChild(parent: XmlNode, child: XmlNode, removeChild: boolean): [XmlNode, XmlNode];
    removeEmptyTextNodes(node: XmlNode): void;
}
declare const xml: XmlUtils;

declare class XmlDepthTracker {
    private depth;
    private readonly maxDepth;
    constructor(maxDepth: number);
    increment(): void;
    decrement(): void;
}

declare class XmlTreeIterator<T extends XmlNode = XmlNode> {
    get node(): T;
    private _current;
    private readonly depthTracker;
    constructor(initial: XmlNode, maxDepth: number);
    next(): XmlNode;
    setCurrent(node: XmlNode): void;
    private findNextNode;
}

declare const RelType: Readonly<{
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
type RelTargetMode = 'Internal' | 'External';
declare class Relationship {
    static fromXml(partDir: string, xml: XmlGeneralNode): Relationship;
    static normalizeRelTarget(partDir: string, target: string): string;
    id: string;
    type: string;
    target: string;
    targetMode: RelTargetMode;
    constructor(initial?: Partial<Relationship>);
    toXml(): XmlGeneralNode;
}

declare class RelsFile {
    private rels;
    private relTargets;
    private nextRelId;
    private readonly partDir;
    private readonly relsFilePath;
    private readonly zip;
    constructor(partPath: string, zip: Zip);
    add(relTarget: string, relType: string, relTargetMode?: RelTargetMode): Promise<string>;
    list(): Promise<Relationship[]>;
    absoluteTargetPath(relTarget: string): string;
    save(): Promise<void>;
    private getNextRelId;
    private parseRelsFile;
    private getRelTargetKey;
    private createRootNode;
}

declare class OpenXmlPart {
    readonly rels: RelsFile;
    readonly path: string;
    private root;
    private readonly openedParts;
    private readonly zip;
    constructor(path: string, zip: Zip);
    xmlRoot(): Promise<XmlNode>;
    getText(): Promise<string>;
    getContentBinary<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
    getPartById(relId: string): Promise<OpenXmlPart>;
    getFirstPartByType(type: string): Promise<OpenXmlPart>;
    getPartsByType(type: string): Promise<OpenXmlPart[]>;
    save(binaryContent?: Binary): Promise<void>;
    private openPart;
}

declare class Docx {
    static load(file: Binary): Promise<Docx>;
    static open(zip: Zip): Promise<Docx>;
    private static getMainDocumentPath;
    readonly mainDocument: OpenXmlPart;
    readonly mediaFiles: MediaFiles;
    readonly contentTypes: ContentTypesFile;
    private readonly zip;
    get rawZipFile(): Zip;
    private constructor();
    getContentParts(): Promise<OpenXmlPart[]>;
    export<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
}

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
declare class OmlNode {
    static readonly W: W;
    static readonly A: A;
    static readonly Wp: Wp;
    static readonly Pic: Pic;
}
declare class OmlAttribute {
    static readonly SpacePreserve = "xml:space";
    static readonly FieldCharType = "w:fldCharType";
}

declare const TagDisposition: Readonly<{
    readonly Open: "Open";
    readonly Close: "Close";
    readonly SelfClosed: "SelfClosed";
}>;
type TagDisposition = typeof TagDisposition[keyof typeof TagDisposition];
declare const TagPlacement: Readonly<{
    readonly TextNode: "TextNode";
    readonly Attribute: "Attribute";
}>;
type TagPlacement = typeof TagPlacement[keyof typeof TagPlacement];
type Tag = TextNodeTag | AttributeTag;
interface BaseTag {
    name: string;
    options?: Record<string, any>;
    rawText: string;
    disposition: TagDisposition;
}
interface TextNodeTag extends BaseTag {
    placement: typeof TagPlacement.TextNode;
    xmlTextNode: XmlTextNode;
}
interface AttributeTag extends BaseTag {
    placement: typeof TagPlacement.Attribute;
    xmlNode: XmlGeneralNode;
    attributeName: string;
}

declare class OfficeMarkup {
    readonly query: Query;
    readonly modify: Modify;
}
declare class Query {
    isTextNode(node: XmlNode): boolean;
    isRunNode(node: XmlNode): boolean;
    isRunPropertiesNode(node: XmlNode): boolean;
    isTableNode(node: XmlNode): boolean;
    isTableCellNode(node: XmlNode): boolean;
    isParagraphNode(node: XmlNode): boolean;
    isParagraphPropertiesNode(node: XmlNode): boolean;
    isListParagraph(paragraphNode: XmlNode): boolean;
    isInlineDrawingNode(node: XmlNode): boolean;
    findParagraphPropertiesNode(paragraphNode: XmlNode): XmlNode;
    firstTextNodeChild(node: XmlNode): XmlNode;
    containingTextNode(node: XmlTextNode): XmlGeneralNode;
    containingRunNode(node: XmlNode): XmlGeneralNode;
    containingParagraphNode(node: XmlNode): XmlGeneralNode;
    containingTableRowNode(node: XmlNode): XmlGeneralNode;
    containingTableCellNode(node: XmlNode): XmlGeneralNode;
    containingTableNode(node: XmlNode): XmlGeneralNode;
    containingStructuredTagContentNode(node: XmlNode): XmlGeneralNode;
    isEmptyTextNode(node: XmlNode): boolean;
    isEmptyRun(node: XmlNode): boolean;
}
declare class Modify {
    splitTextNode(textNode: XmlTextNode, splitIndex: number, addBefore: boolean): XmlTextNode;
    splitParagraphByTextNode(paragraph: XmlNode, textNode: XmlTextNode, removeTextNode: boolean): [XmlNode, XmlNode];
    joinTextNodesRange(from: XmlTextNode, to: XmlTextNode): void;
    joinParagraphs(first: XmlNode, second: XmlNode): void;
    setSpacePreserveAttribute(node: XmlGeneralNode): void;
    removeTag(tag: Tag): void;
}
declare const officeMarkup: OfficeMarkup;

declare class Xlsx {
    static load(file: Binary): Promise<Xlsx>;
    static open(zip: Zip): Promise<Xlsx>;
    private static getMainDocumentPath;
    readonly mainDocument: OpenXmlPart;
    private readonly _parts;
    private readonly zip;
    get rawZipFile(): Zip;
    private constructor();
    export<T extends Binary>(outputType?: Constructor<T>): Promise<T>;
    private saveXmlChanges;
}

type DelimiterMark = TextNodeDelimiterMark | AttributeDelimiterMark;
interface BaseDelimiterMark {
    openXmlPart?: OpenXmlPart;
    isOpen: boolean;
}
interface TextNodeDelimiterMark extends BaseDelimiterMark {
    placement: typeof TagPlacement.TextNode;
    xmlTextNode: XmlTextNode;
    index: number;
}
interface AttributeDelimiterMark extends BaseDelimiterMark {
    placement: typeof TagPlacement.Attribute;
    xmlNode: XmlGeneralNode;
    attributeName: string;
    index: number;
}

declare class Delimiters {
    tagStart: string;
    tagEnd: string;
    containerTagOpen: string;
    containerTagClose: string;
    tagOptionsStart: string;
    tagOptionsEnd: string;
    constructor(initial?: Partial<Delimiters>);
    private encodeAndValidate;
}

declare class DelimiterSearcher {
    private readonly maxXmlDepth;
    private readonly delimiters;
    constructor(delimiters: Delimiters, maxXmlDepth: number);
    findDelimiters(node: XmlNode): DelimiterMark[];
}

interface PluginContent {
    _type: string;
    [key: string]: unknown;
}
declare const PluginContent: {
    isPluginContent(content: unknown): content is PluginContent;
};

type ImageFormat = typeof MimeType.Jpeg | typeof MimeType.Png | typeof MimeType.Gif | typeof MimeType.Bmp | typeof MimeType.Svg;
interface ImageContent extends PluginContent {
    _type: 'image';
    source: Binary;
    format: ImageFormat;
    width?: number;
    height?: number;
    altText?: string;
    transparencyPercent?: number;
}

interface TemplateContext {
    docx: Docx;
    currentPart: OpenXmlPart;
    pluginContext: Record<string, any>;
    options: TemplateOptions;
}
interface TemplateOptions {
    maxXmlDepth: number;
}

interface PluginUtilities {
    compiler: TemplateCompiler;
}
declare abstract class TemplatePlugin {
    abstract readonly contentType: string;
    protected utilities: PluginUtilities;
    setUtilities(utilities: PluginUtilities): void;
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): void | Promise<void>;
    containerTagReplacements(tags: Tag[], data: ScopeData, context: TemplateContext): void | Promise<void>;
}

declare class ImagePlugin extends TemplatePlugin {
    readonly contentType = "image";
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): Promise<void>;
    private getNextImageId;
}

interface LinkContent extends PluginContent {
    _type: 'link';
    text?: string;
    target: string;
    tooltip?: string;
}

declare class LinkPlugin extends TemplatePlugin {
    readonly contentType = "link";
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): Promise<void>;
    private generateMarkup;
    private insertHyperlinkNode;
}

declare const LOOP_CONTENT_TYPE = "loop";
declare class LoopPlugin extends TemplatePlugin {
    readonly contentType = "loop";
    private readonly loopStrategies;
    setUtilities(utilities: PluginUtilities): void;
    containerTagReplacements(tags: Tag[], data: ScopeData, context: TemplateContext): Promise<void>;
    private repeat;
    private compile;
    private updatePathBefore;
    private updatePathAfter;
}

interface RawXmlContent extends PluginContent {
    _type: 'rawXml';
    xml: string | string[];
    replaceParagraph?: boolean;
}

declare class RawXmlPlugin extends TemplatePlugin {
    readonly contentType = "rawXml";
    simpleTagReplacements(tag: Tag, data: ScopeData): void;
}

declare const TEXT_CONTENT_TYPE = "text";
declare class TextPlugin extends TemplatePlugin {
    readonly contentType = "text";
    simpleTagReplacements(tag: Tag, data: ScopeData): void;
    private replaceInTextNode;
    private replaceInAttribute;
    private replaceSingleLine;
    private replaceMultiLine;
    private getLineBreak;
    private createOfficeTextNode;
}

type ChartData = StandardChartData | ScatterChartData | BubbleChartData;
interface StandardChartData {
    categories: Categories;
    series: Series[];
}
interface ScatterChartData {
    series: ScatterSeries[];
}
interface BubbleChartData {
    series: BubbleSeries[];
}
type Categories = NumericCategories | StringCategories | DateCategories;
interface NumericCategories {
    formatCode?: NumberingFormat;
    names: number[];
}
interface StringCategories {
    names: string[];
}
interface DateCategories {
    formatCode?: DateTimeFormat;
    names: Date[];
}
interface Series {
    name?: string;
    color?: string;
    values: number[];
}
interface ScatterSeries {
    name?: string;
    color?: string;
    values: ScatterValue[];
}
interface ScatterValue {
    x: number;
    y: number;
}
interface BubbleSeries {
    name?: string;
    color?: string;
    values: BubbleValue[];
}
interface BubbleValue extends ScatterValue {
    size: number;
}
declare const NumberingFormatValues: Readonly<{
    readonly General: "General";
    readonly Integer: "0";
    readonly Decimal_2Places: "0.00";
    readonly ThousandsSeparator: "#,##0";
    readonly ThousandsSeparator_2DecimalPlaces: "#,##0.00";
    readonly ThousandsSeparator_ParenthesesForNegatives: "#,##0 ;(#,##0)";
    readonly ThousandsSeparator_RedNegatives: "#,##0 ;[Red](#,##0)";
    readonly ThousandsSeparator_2DecimalPlaces_ParenthesesForNegatives: "#,##0.00;(#,##0.00)";
    readonly ThousandsSeparator_2DecimalPlaces_RedNegatives: "#,##0.00;[Red](#,##0.00)";
    readonly Percentage: "0%";
    readonly Percentage_2DecimalPlaces: "0.00%";
    readonly Scientific: "0.00E+00";
    readonly Scientific_1DecimalPlace: "##0.0E+0";
    readonly Fraction_SingleDigit: "# ?/?";
    readonly Fraction_DoubleDigit: "# ??/?";
    readonly Text: "@";
}>;
type NumberingFormat = typeof NumberingFormatValues[keyof typeof NumberingFormatValues];
declare const DateTimeFormatValues: Readonly<{
    readonly General: "General";
    readonly Date_Short: "mm-dd-yy";
    readonly Date_DayMonthYear: "d-mmm-yy";
    readonly Date_DayMonth: "d-mmm";
    readonly Date_MonthYear: "mmm-yy";
    readonly Time_12Hour: "h:mm AM/PM";
    readonly Time_12Hour_WithSeconds: "h:mm:ss AM/PM";
    readonly Time_24Hour: "h:mm";
    readonly Time_24Hour_WithSeconds: "h:mm:ss";
    readonly DateTime_Short: "m/d/yy h:mm";
    readonly Time_MinutesSeconds: "mm:ss";
    readonly Time_ElapsedHoursMinutesSeconds: "[h]:mm:ss";
    readonly Time_CompactMinutesSecondsWithDecimal: "mmss.0";
    readonly Text: "@";
}>;
type DateTimeFormat = typeof DateTimeFormatValues[keyof typeof DateTimeFormatValues];

type ChartContent = ChartPluginContent & ChartData;
interface ChartPluginContent extends PluginContent {
    _type: 'chart';
    title?: string;
}

declare class ChartPlugin extends TemplatePlugin {
    readonly contentType = "chart";
    simpleTagReplacements(tag: Tag, data: ScopeData, context: TemplateContext): Promise<void>;
}

declare function createDefaultPlugins(): TemplatePlugin[];

type PrimitiveTemplateContent = string | number | boolean;
type TemplateContent = PrimitiveTemplateContent | PluginContent;
interface TemplateData {
    [tagName: string]: TemplateContent | TemplateData | TemplateData[];
}

type PathPart = Tag | number;
interface ScopeDataArgs {
    path: PathPart[];
    strPath: string[];
    data: TemplateData;
}
type ScopeDataResolver = (args: ScopeDataArgs) => TemplateContent | TemplateData[];
declare class ScopeData {
    static defaultResolver(args: ScopeDataArgs): TemplateContent | TemplateData[];
    scopeDataResolver: ScopeDataResolver;
    allData: TemplateData;
    private readonly path;
    private readonly strPath;
    constructor(data: TemplateData);
    pathPush(pathPart: PathPart): void;
    pathPop(): Tag | number;
    pathString(): string;
    getScopeData<T extends TemplateContent | TemplateData[]>(): T;
}

declare class TagParser {
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

interface TemplateCompilerOptions {
    defaultContentType: string;
    containerContentType: string;
    skipEmptyTags?: boolean;
}
declare class TemplateCompiler {
    private readonly pluginsLookup;
    private readonly delimiterSearcher;
    private readonly tagParser;
    private readonly options;
    constructor(delimiterSearcher: DelimiterSearcher, tagParser: TagParser, plugins: TemplatePlugin[], options: TemplateCompilerOptions);
    compile(node: XmlNode, data: ScopeData, context: TemplateContext): Promise<void>;
    parseTags(node: XmlNode): Tag[];
    private doTagReplacements;
    private detectContentType;
    private simpleTagReplacements;
    private findCloseTagIndex;
}

interface ExtensionUtilities {
    compiler: TemplateCompiler;
    tagParser: TagParser;
}
declare abstract class TemplateExtension {
    protected utilities: ExtensionUtilities;
    setUtilities(utilities: ExtensionUtilities): void;
    abstract execute(data: ScopeData, context: TemplateContext): void | Promise<void>;
}

interface ExtensionOptions {
    beforeCompilation?: TemplateExtension[];
    afterCompilation?: TemplateExtension[];
}

declare class InternalError extends Error {
    constructor(message: string);
}

declare class InternalArgumentMissingError extends InternalError {
    readonly argName: string;
    constructor(argName: string);
}

declare class MalformedFileError extends Error {
    constructor(message: string);
}

declare class MaxXmlDepthError extends Error {
    readonly maxDepth: number;
    constructor(maxDepth: number);
}

declare class TemplateSyntaxError extends Error {
    constructor(message: string);
}

declare class MissingCloseDelimiterError extends TemplateSyntaxError {
    readonly openDelimiterText: string;
    constructor(openDelimiterText: string);
}

declare class MissingStartDelimiterError extends TemplateSyntaxError {
    readonly closeDelimiterText: string;
    constructor(closeDelimiterText: string);
}

declare class TagOptionsParseError extends TemplateSyntaxError {
    readonly tagRawText: string;
    readonly parseError: Error;
    constructor(tagRawText: string, parseError: Error);
}

declare class TemplateDataError extends Error {
    constructor(message: string);
}

declare class UnclosedTagError extends TemplateSyntaxError {
    readonly tagName: string;
    readonly tagRawText: string;
    constructor(tagName: string, tagRawText: string);
}

declare class UnidentifiedFileTypeError extends Error {
    constructor();
}

declare class UnknownContentTypeError extends TemplateDataError {
    readonly tagRawText: string;
    readonly contentType: string;
    readonly path: string;
    constructor(contentType: string, tagRawText: string, path: string);
}

declare class UnopenedTagError extends TemplateSyntaxError {
    readonly tagName: string;
    readonly tagRawText: string;
    constructor(tagName: string, tagRawText: string);
}

declare class UnsupportedFileTypeError extends Error {
    readonly fileType: string;
    constructor(fileType: string);
}

declare class TemplateHandlerOptions {
    plugins?: TemplatePlugin[];
    skipEmptyTags?: boolean;
    defaultContentType?: string;
    containerContentType?: string;
    delimiters?: Partial<Delimiters>;
    maxXmlDepth?: number;
    extensions?: ExtensionOptions;
    scopeDataResolver?: ScopeDataResolver;
    constructor(initial?: Partial<TemplateHandlerOptions>);
}

declare class TemplateHandler {
    readonly version: string;
    private readonly compiler;
    private readonly options;
    constructor(options?: TemplateHandlerOptions);
    process<T extends Binary>(templateFile: T, data: TemplateData): Promise<T>;
    parseTags(templateFile: Binary): Promise<Tag[]>;
    getText(docxFile: Binary, relType?: string): Promise<string>;
    getXml(docxFile: Binary, relType?: string): Promise<XmlNode>;
    getParts(docxFile: Binary, relType: string): Promise<OpenXmlPart[]>;
    private callExtensions;
}

export { Base64, Binary, COMMENT_NODE_NAME, ChartPlugin, DelimiterSearcher, Delimiters, Docx, ImagePlugin, InternalArgumentMissingError, InternalError, LOOP_CONTENT_TYPE, LinkPlugin, LoopPlugin, MalformedFileError, MaxXmlDepthError, MimeType, MimeTypeHelper, MissingCloseDelimiterError, MissingStartDelimiterError, OfficeMarkup, OmlAttribute, OmlNode, OpenXmlPart, Path, PluginContent, RawXmlPlugin, Regex, RelType, Relationship, ScopeData, TEXT_CONTENT_TYPE, TEXT_NODE_NAME, TagDisposition, TagOptionsParseError, TagParser, TagPlacement, TemplateCompiler, TemplateDataError, TemplateExtension, TemplateHandler, TemplateHandlerOptions, TemplatePlugin, TemplateSyntaxError, TextPlugin, UnclosedTagError, UnidentifiedFileTypeError, UnknownContentTypeError, UnopenedTagError, UnsupportedFileTypeError, Xlsx, XmlDepthTracker, XmlNodeType, XmlTreeIterator, XmlUtils, Zip, ZipObject, countOccurrences, createDefaultPlugins, first, inheritsFrom, isNumber, isPromiseLike, last, normalizeDoubleQuotes, officeMarkup, pushMany, sha1, stringValue, toDictionary, xml };
export type { AttributeDelimiterMark, AttributeTag, BaseDelimiterMark, BaseTag, ChartContent, DelimiterMark, ExtensionOptions, ExtensionUtilities, ImageContent, ImageFormat, ItemMapper, LinkContent, NodeTypeToNode, PathPart, PluginUtilities, PrimitiveTemplateContent, RawXmlContent, RelTargetMode, ScopeDataArgs, ScopeDataResolver, Tag, TemplateCompilerOptions, TemplateContent, TemplateContext, TemplateData, TemplateOptions, TextNodeDelimiterMark, TextNodeTag, XmlCommentNode, XmlGeneralNode, XmlNode, XmlNodeBase, XmlNodePredicate, XmlSerializationOptions, XmlTextNode };
