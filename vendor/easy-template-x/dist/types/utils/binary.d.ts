import { Constructor } from '../types';
export type Binary = Blob | Buffer | ArrayBuffer;
export declare const Binary: {
    isBlob(binary: unknown): binary is Blob;
    isArrayBuffer(binary: unknown): binary is ArrayBuffer;
    isBuffer(binary: unknown): binary is Buffer;
    isBlobConstructor(binaryType: Constructor<unknown>): binaryType is Constructor<Blob>;
    isArrayBufferConstructor(binaryType: Constructor<unknown>): binaryType is Constructor<ArrayBuffer>;
    isBufferConstructor(binaryType: Constructor<unknown>): binaryType is Constructor<Buffer>;
    toBase64(binary: Binary): Promise<string>;
};
