import { MimeType } from '../mimeType';
import { Binary } from '../utils';
import { Zip } from '../zip';
export declare class MediaFiles {
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
