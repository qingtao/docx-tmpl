import { OpenXmlPart } from "src/office/openXmlPart";
import { XmlNode } from "src/xml";
import { ChartType } from "./chartData";
export interface SeriesAccentColor {
    name: string;
    lumMod: string;
    lumOff: string;
}
export declare class ChartColors {
    static load(chartPart: OpenXmlPart): Promise<ChartColors>;
    private accents;
    private variations;
    private initialized;
    private readonly chartPart;
    private constructor();
    setSeriesColor(chartType: ChartType, seriesNode: XmlNode, isNewSeries: boolean, color: string | number): void;
    private recurseSetColor;
    private setAccentColor;
    private getAccentColorConfig;
    private init;
}
