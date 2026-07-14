export declare class Delimiters {
    tagStart: string;
    tagEnd: string;
    containerTagOpen: string;
    containerTagClose: string;
    tagOptionsStart: string;
    tagOptionsEnd: string;
    constructor(initial?: Partial<Delimiters>);
    private encodeAndValidate;
}
