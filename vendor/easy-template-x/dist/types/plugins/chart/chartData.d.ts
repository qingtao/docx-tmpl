export type ChartData = StandardChartData | ScatterChartData | BubbleChartData;
export interface StandardChartData {
    categories: Categories;
    series: Series[];
}
export interface ScatterChartData {
    series: ScatterSeries[];
}
export interface BubbleChartData {
    series: BubbleSeries[];
}
export type Categories = NumericCategories | StringCategories | DateCategories;
export interface NumericCategories {
    formatCode?: NumberingFormat;
    names: number[];
}
export interface StringCategories {
    names: string[];
}
export interface DateCategories {
    formatCode?: DateTimeFormat;
    names: Date[];
}
export interface Series {
    name?: string;
    color?: string;
    values: number[];
}
export interface ScatterSeries {
    name?: string;
    color?: string;
    values: ScatterValue[];
}
export interface ScatterValue {
    x: number;
    y: number;
}
export interface BubbleSeries {
    name?: string;
    color?: string;
    values: BubbleValue[];
}
export interface BubbleValue extends ScatterValue {
    size: number;
}
export declare const chartTypes: Readonly<{
    readonly area3DChart: "c:area3DChart";
    readonly areaChart: "c:areaChart";
    readonly bar3DChart: "c:bar3DChart";
    readonly barChart: "c:barChart";
    readonly line3DChart: "c:line3DChart";
    readonly lineChart: "c:lineChart";
    readonly doughnutChart: "c:doughnutChart";
    readonly ofPieChart: "c:ofPieChart";
    readonly pie3DChart: "c:pie3DChart";
    readonly pieChart: "c:pieChart";
    readonly scatterChart: "c:scatterChart";
    readonly bubbleChart: "c:bubbleChart";
}>;
export type ChartType = typeof chartTypes[keyof typeof chartTypes];
export declare const NumberingFormatValues: Readonly<{
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
export type NumberingFormat = typeof NumberingFormatValues[keyof typeof NumberingFormatValues];
export declare const DateTimeFormatValues: Readonly<{
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
export type DateTimeFormat = typeof DateTimeFormatValues[keyof typeof DateTimeFormatValues];
export declare const formatIds: Readonly<{
    General: 0;
    "0": 1;
    "0.00": 2;
    "#,##0": 3;
    "#,##0.00": 4;
    "0%": 9;
    "0.00%": 10;
    "0.00E+00": 11;
    "# ?/?": 12;
    "# ??/?": 13;
    "mm-dd-yy": 14;
    "d-mmm-yy": 15;
    "d-mmm": 16;
    "mmm-yy": 17;
    "h:mm AM/PM": 18;
    "h:mm:ss AM/PM": 19;
    "h:mm": 20;
    "h:mm:ss": 21;
    "m/d/yy h:mm": 22;
    "#,##0 ;(#,##0)": 37;
    "#,##0 ;[Red](#,##0)": 38;
    "#,##0.00;(#,##0.00)": 39;
    "#,##0.00;[Red](#,##0.00)": 40;
    "mm:ss": 45;
    "[h]:mm:ss": 46;
    "mmss.0": 47;
    "##0.0E+0": 48;
    "@": 49;
}>;
export type FormatCode = NumberingFormat | DateTimeFormat;
export declare function chartFriendlyName(chartType: ChartType): string;
export declare function isStandardChartType(chartType: ChartType): boolean;
export declare function isScatterChartType(chartType: ChartType): boolean;
export declare function isBubbleChartType(chartType: ChartType): boolean;
export declare function isStandardChartData(chartData: ChartData): chartData is StandardChartData;
export declare function isScatterChartData(chartData: ChartData): chartData is ScatterChartData;
export declare function isBubbleChartData(chartData: ChartData): chartData is BubbleChartData;
export declare function isStringCategories(categories: Categories): categories is StringCategories;
export declare function isDateCategories(categories: Categories): categories is DateCategories;
export declare function formatCode(categories: Categories): FormatCode;
export declare function scatterXValues(series: ScatterSeries[]): number[];
export declare function scatterYValues(xValues: number[], series: ScatterSeries): number[];
export declare function bubbleSizeValues(xValues: number[], series: BubbleSeries): number[];
