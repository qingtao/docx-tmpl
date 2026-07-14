import JSZip from 'jszip';
import { Constructor } from '../types';
import { Binary } from '../utils';
export declare class ZipObject {
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
