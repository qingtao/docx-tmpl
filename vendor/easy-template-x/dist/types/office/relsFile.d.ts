import { Zip } from "src/zip";
import { Relationship, RelTargetMode } from "./relationship";
export declare class RelsFile {
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
