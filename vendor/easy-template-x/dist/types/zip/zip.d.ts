import { Constructor } from '../types';
import { Binary } from '../utils';
import { ZipObject } from './zipObject';
export declare class Zip {
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
